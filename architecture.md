# Part 2: Event-Driven Architecture

## Definition

Event-Driven Architecture is a design paradigm where:

- Components communicate by generating and responding to events.
- An event represents a significant state change.
- Producers and consumers of events are loosely coupled.
- Processing can be asynchronous.

---

## Event Mechanism in the System

The system operates using events such as:

- Metric Collected Event  
- Threshold Exceeded Event  
- Alert Generated Event  
- Notification Sent Event  

### Typical Flow

1. Metrics are collected by the monitoring module.
2. If thresholds are exceeded, an event is generated.
3. The alert module processes the event.
4. The notification module reacts and sends alerts.
5. The logging module records system activities.

---

## Justification

The system satisfies Event-Driven Architecture because:

- Modules communicate through events.
- Direct dependency between modules is reduced.
- Components respond asynchronously.
- Loose coupling improves flexibility and reliability.

---
