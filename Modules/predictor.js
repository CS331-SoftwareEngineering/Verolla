/**
 * Verolla Predictive Alert Engine  v2
 * -------------------------------------
 * MODEL 1 – TREND  (exponentially-weighted linear regression)
 *   Recent samples carry more weight. Fires only when R²≥0.65,
 *   slope≥0.08%/s, ETA is 45 s – 5 min away. Confidence blends fit
 *   quality with urgency (closer breach → higher confidence).
 *
 * MODEL 2 – PATTERN  (temporal recurrence memory)
 *   Fires only when ≥3 historical breaches overlap the current
 *   hour-of-day (±1 h) and day-of-week, the metric is at ≥75 %
 *   of threshold, AND the trend is currently upward.
 *
 * Cooldown / re-fire rules
 *   • At most ONE active prediction per (metric, kind).
 *   • Resolves only after the metric stays below threshold × 0.80
 *     for 2 consecutive cycles (anti-flapping).
 *   • After resolution a 10-minute cooldown blocks re-fire of the
 *     same key, so the user is not spammed with repeats.
 */

'use strict';

const { metricsDAL, settingsDAL, predictionsDAL, notificationDAL } = require('./dal');

// ─── Tunables ────────────────────────────────────────────────────────────────
const TREND_WINDOW           = 20;
const FORECAST_HORIZON_SEC   = 300;
const MIN_ETA_SEC            = 45;
const MIN_TREND_R2           = 0.65;
const MIN_TREND_SLOPE        = 0.08;
const EWMA_ALPHA             = 0.7;

const PATTERN_LOOKBACK_DAYS  = 14;
const PATTERN_MIN_HITS       = 3;
const PATTERN_HOUR_TOLERANCE = 1;
const PATTERN_ELEV_RATIO     = 0.75;

const COOLOFF_RATIO          = 0.80;
const RESOLVE_CONFIRM_CYCLES = 2;
const REFIRE_COOLDOWN_MS     = 10 * 60 * 1000;

// ─── In-memory state ─────────────────────────────────────────────────────────
const refireBlockedUntil = {};
const lowCycleCount      = {};

function stateKey(metric, kind) { return `${metric}:${kind}`; }

// ─── Math: exponentially-weighted linear regression ──────────────────────────
function ewLinearRegression(samples) {
    const n = samples.length;
    if (n < 5) return null;

    const alpha = EWMA_ALPHA;
    let W = 0, Wx = 0, Wy = 0, Wxx = 0, Wxy = 0;
    for (let i = 0; i < n; i++) {
        const w = Math.pow(alpha, n - 1 - i);
        const { t, y } = samples[i];
        W += w; Wx += w * t; Wy += w * y; Wxx += w * t * t; Wxy += w * t * y;
    }
    const denom = W * Wxx - Wx * Wx;
    if (Math.abs(denom) < 1e-10) return null;

    const slope     = (W * Wxy - Wx * Wy) / denom;
    const intercept = (Wy - slope * Wx) / W;

    const meanY = Wy / W;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
        const w = Math.pow(alpha, n - 1 - i);
        const { t, y } = samples[i];
        ssRes += w * (y - (slope * t + intercept)) ** 2;
        ssTot += w * (y - meanY) ** 2;
    }
    const r2 = ssTot < 1e-10 ? 1 : Math.max(0, 1 - ssRes / ssTot);
    return { slope, intercept, r2 };
}

// ─── Model 1: TREND ──────────────────────────────────────────────────────────
function trendPrediction(metricName, getter, threshold) {
    const recent = metricsDAL.findRecent(TREND_WINDOW);
    if (recent.length < 8) return null;

    const ordered = recent.slice().reverse();
    const t0 = new Date(ordered[0].recordedAt).getTime();
    const samples = ordered.map(r => ({
        t: (new Date(r.recordedAt).getTime() - t0) / 1000,
        y: getter(r)
    }));

    const fit = ewLinearRegression(samples);
    if (!fit)                        return null;
    if (fit.slope < MIN_TREND_SLOPE) return null;
    if (fit.r2    < MIN_TREND_R2)    return null;

    const last = samples[samples.length - 1];
    if (last.y >= threshold) return null;

    const tBreach    = (threshold - fit.intercept) / fit.slope;
    const etaSeconds = Math.round(tBreach - last.t);
    if (etaSeconds < MIN_ETA_SEC)          return null;
    if (etaSeconds > FORECAST_HORIZON_SEC) return null;

    const urgencyBonus = 1 - (etaSeconds / FORECAST_HORIZON_SEC);
    const confidence   = Math.round(Math.min(0.97, fit.r2 * 0.7 + urgencyBonus * 0.3) * 100) / 100;

    return {
        metric: metricName, kind: 'trend', confidence, etaSeconds,
        currentValue: Math.round(last.y), threshold,
        slope: Math.round(fit.slope * 1000) / 1000,
        reason: `Rising trend (EW slope ${(fit.slope * 60).toFixed(2)} %/min, R²=${fit.r2.toFixed(2)}) — ${metricName} projected to breach ${threshold}% in ~${etaSeconds}s`
    };
}

// ─── Model 2: PATTERN ────────────────────────────────────────────────────────
function patternPrediction(metricName, currentValue, threshold, getter) {
    if (currentValue < threshold * PATTERN_ELEV_RATIO) return null;

    // Require an upward trend before firing pattern warning
    const recent = metricsDAL.findRecent(10);
    if (recent.length >= 5) {
        const ordered = recent.slice().reverse();
        const t0 = new Date(ordered[0].recordedAt).getTime();
        const samples = ordered.map(r => ({
            t: (new Date(r.recordedAt).getTime() - t0) / 1000,
            y: getter(r)
        }));
        const fit = ewLinearRegression(samples);
        if (fit && fit.slope <= 0) return null;
    }

    const history = predictionsDAL.historicalBreachHours(metricName);
    if (history.length < PATTERN_MIN_HITS) return null;

    const cutoff  = Date.now() - PATTERN_LOOKBACK_DAYS * 24 * 3600 * 1000;
    const recentH = history.filter(h => h.ts >= cutoff);
    if (recentH.length < PATTERN_MIN_HITS) return null;

    const now     = new Date();
    const nowHour = now.getHours();
    const nowDow  = now.getDay();
    const matches = recentH.filter(h => {
        const delta = Math.min(Math.abs(h.hour - nowHour), 24 - Math.abs(h.hour - nowHour));
        return delta <= PATTERN_HOUR_TOLERANCE && h.dow === nowDow;
    });
    if (matches.length < PATTERN_MIN_HITS) return null;

    const confidence = Math.round(
        Math.min(0.95, Math.max(0.10, matches.length / (PATTERN_LOOKBACK_DAYS / 7))) * 100
    ) / 100;

    return {
        metric: metricName, kind: 'pattern', confidence,
        etaSeconds: null, currentValue, threshold, slope: null,
        reason: `Recurring pattern: ${metricName} breached ${matches.length}× on ${dayName(nowDow)} near ${pad(nowHour)}:00 (last ${PATTERN_LOOKBACK_DAYS} days); current value ${currentValue}% is in the danger zone.`
    };
}

function dayName(d) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]; }
function pad(n)     { return String(n).padStart(2, '0'); }

// ─── Persistence + dedupe ────────────────────────────────────────────────────
function persistPrediction(p, onNew) {
    const key = stateKey(p.metric, p.kind);

    if (predictionsDAL.findActiveByKey(p.metric, p.kind)) return null;

    const blocked = refireBlockedUntil[key];
    if (blocked && Date.now() < blocked) return null;

    const row = predictionsDAL.insert(p);
    predictionsDAL.pruneOld();

    const now = new Date();
    notificationDAL.insert({
        time:      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        service:   p.metric,
        alert:     `[AI Prediction] ${p.reason}`,
        severity:  'medium',
        status:    'Predicted',
        channel:   'AI',
        timestamp: now.getTime()
    });

    lowCycleCount[key] = 0;
    if (typeof onNew === 'function') onNew(row);
    return row;
}

function maybeResolve(metric, kind, currentValue, threshold) {
    const key    = stateKey(metric, kind);
    const active = predictionsDAL.findActiveByKey(metric, kind);
    if (!active) return;

    if (currentValue < threshold * COOLOFF_RATIO) {
        lowCycleCount[key] = (lowCycleCount[key] || 0) + 1;
        if (lowCycleCount[key] >= RESOLVE_CONFIRM_CYCLES) {
            predictionsDAL.resolveByKey(metric, kind);
            refireBlockedUntil[key] = Date.now() + REFIRE_COOLDOWN_MS;
            lowCycleCount[key] = 0;
            console.log(`[PREDICTOR] ${metric}/${kind} resolved — refire blocked for ${REFIRE_COOLDOWN_MS / 60000} min`);
        }
    } else {
        lowCycleCount[key] = 0;
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────
function runCycle({ cpu, mem, disk }, onNewPrediction) {
    const cfg = settingsDAL.getAll();
    const targets = [
        { name: 'CPU',    val: cpu,  thr: cfg.cpuThreshold,  getter: r => r.cpuUsage  },
        { name: 'Memory', val: mem,  thr: cfg.memThreshold,  getter: r => r.memUsage  },
        { name: 'Disk',   val: disk, thr: cfg.diskThreshold, getter: r => r.diskUsage }
    ];

    const fired = [];
    for (const t of targets) {
        maybeResolve(t.name, 'trend',   t.val, t.thr);
        maybeResolve(t.name, 'pattern', t.val, t.thr);

        const trend = trendPrediction(t.name, t.getter, t.thr);
        if (trend) {
            const r = persistPrediction(trend, onNewPrediction);
            if (r) fired.push(r);
        }

        const pattern = patternPrediction(t.name, t.val, t.thr, t.getter);
        if (pattern) {
            const r = persistPrediction(pattern, onNewPrediction);
            if (r) fired.push(r);
        }
    }
    return fired;
}

module.exports = {
    runCycle,
    _internal: { ewLinearRegression, trendPrediction, patternPrediction }
};
