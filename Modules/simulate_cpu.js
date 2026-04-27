const os = require('os');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
  Verolla CPU Stress Simulator
  ────────────────────────────
  Spins all CPU cores to push usage above 85% and trigger the
  monitoring engine's sustained-threshold alert (>85% for 60s).

  Usage:
    node simulate_cpu.js [duration_in_seconds]

  Examples:
    node simulate_cpu.js
    node simulate_cpu.js 120
    node simulate_cpu.js 30
`);
    process.exit(0);
}

const DURATION_SEC = parseInt(args[0], 10) || 90;
const NUM_CORES = os.cpus().length;

console.log('');
console.log('  ╔══════════════════════════════════════════════════╗');
console.log('  ║        VEROLLA CPU STRESS SIMULATOR              ║');
console.log('  ╠══════════════════════════════════════════════════╣');
console.log(`  ║  Cores detected:    ${String(NUM_CORES).padEnd(28)}║`);
console.log(`  ║  Duration:          ${String(DURATION_SEC + 's').padEnd(28)}║`);
console.log(`  ║  Target:            >85% CPU for 60s+            ║`);
console.log('  ╠══════════════════════════════════════════════════╣');
console.log('  ║  Press Ctrl+C to stop early                      ║');
console.log('  ╚══════════════════════════════════════════════════╝');
console.log('');

const { Worker, isMainThread } = require('worker_threads');

if (!isMainThread) {
    const end = Date.now() + (Number(process.env.STRESS_DURATION_MS) || 90000);
    while (Date.now() < end) {
        let x = 0;
        for (let i = 0; i < 1e6; i++) {
            x += Math.sqrt(i) * Math.sin(i);
        }
    }
    process.exit(0);
}

const durationMs = DURATION_SEC * 1000;
const startTime = Date.now();
const workers = [];

for (let i = 0; i < NUM_CORES; i++) {
    const worker = new Worker(__filename, {
        env: { ...process.env, STRESS_DURATION_MS: String(durationMs) }
    });
    workers.push(worker);
    worker.on('exit', () => {});
    worker.on('error', (err) => {
        console.error(`  [Worker ${i}] Error:`, err.message);
    });
}

console.log(`  ⚡ Spawned ${NUM_CORES} worker threads — CPU burn started!\n`);

let previousCpus = os.cpus();

const progressInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const remaining = Math.max(0, DURATION_SEC - elapsed);

    const currentCpus = os.cpus();
    let totalIdleDiff = 0, totalTickDiff = 0;
    currentCpus.forEach((core, i) => {
        const prev = previousCpus[i].times;
        const curr = core.times;
        let pTotal = 0, cTotal = 0;
        for (const t in curr) { cTotal += curr[t]; pTotal += prev[t]; }
        totalIdleDiff += (curr.idle - prev.idle);
        totalTickDiff += (cTotal - pTotal);
    });
    previousCpus = currentCpus;
    const cpuPercent = totalTickDiff === 0 ? 0 : Math.round(100 - (100 * totalIdleDiff / totalTickDiff));

    const barLen = 30;
    const filled = Math.round((cpuPercent / 100) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

    const cpuColor = cpuPercent > 85 ? '\x1b[31m' : cpuPercent > 60 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';

    process.stdout.write(
        `\r  ${cpuColor}CPU: ${bar} ${String(cpuPercent).padStart(3)}%${reset}  ` +
        `| Elapsed: ${String(elapsed).padStart(3)}s  ` +
        `| Remaining: ${String(remaining).padStart(3)}s  ` +
        `${cpuPercent > 85 ? '🔥 ABOVE THRESHOLD' : '⏳ Ramping up...'}   `
    );
}, 2000);

function shutdown() {
    clearInterval(progressInterval);
    console.log('\n');
    console.log('  ────────────────────────────────────────────────');
    console.log('  ✅ CPU stress test complete.');
    console.log('  📊 Check the Verolla dashboard for triggered alerts.');
    console.log('     → http://localhost:3000/dashboard.html');
    console.log('     → http://localhost:3000/alerts.html');
    console.log('     → http://localhost:3000/notifications.html');
    console.log('  ────────────────────────────────────────────────\n');

    workers.forEach(w => {
        try { w.terminate(); } catch (_) {}
    });
    process.exit(0);
}

setTimeout(shutdown, durationMs + 2000);

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
