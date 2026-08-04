/**
 * Event Bus Service
 * ------------------------------------------------------------------
 * Sprint 14: the reusable event-driven core the sprint brief asks
 * for — "Existing modules should publish events instead of directly
 * creating notifications." Every module (leave, expense, payroll,
 * employee, department, team, vendor, budget, holiday, reports) calls
 * eventBusService.publish(EVENT_TYPES.X, payload) at its existing
 * success point; notificationService.js and activityService.js
 * subscribe once at boot (see registerSubscribers.js) rather than
 * being called directly by every module — this is what keeps
 * notification/activity logic OUT of each module's service file.
 *
 * Deliberately a thin wrapper over Node's built-in EventEmitter, not a
 * new dependency — this is a single-process Express app (confirmed: no
 * existing message-queue/worker infrastructure anywhere in this
 * codebase), so an in-process bus is the right level of complexity.
 *
 * publish() is async and awaits all subscribers via Promise.allSettled
 * — NOT EventEmitter's native synchronous .emit(), which would let a
 * throwing handler crash the process or (worse) silently swallow
 * errors from unrelated handlers. This mirrors auditLogRepository.js's
 * own "logging failure should never block the caller's real request"
 * philosophy: publish() never throws, and a failing subscriber (e.g.
 * notificationService failing to write a row) never prevents another
 * subscriber (e.g. activityService) from running, and never bubbles
 * up to break the controller action that triggered the event.
 *
 * NOT used for anything synchronous or request-blocking — callers
 * should never `await` publish() for correctness (only for cleanup /
 * test-determinism), since by design an event failing must not fail
 * the original request. See the fire-and-forget note on publish()
 * below for the exact recommended call pattern.
 */

const { EventEmitter } = require("events");

class EventBusService extends EventEmitter {
  constructor() {
    super();
    // Node's default max-listeners warning (10) is too low once
    // notificationService + activityService + any future subscriber
    // all listen on the same growing set of 17 event types — raised
    // generously rather than tuned to an exact count that would need
    // revisiting every time a subscriber is added.
    this.setMaxListeners(50);
  }

  /**
   * Registers a handler for an event type. Thin passthrough to
   * EventEmitter.on() — kept as an explicit method (rather than having
   * callers use .on() directly) so registerSubscribers.js reads as
   * "subscribing to the bus" rather than "using Node internals", and
   * so a future swap to a real message queue only requires changing
   * this file, not every subscriber.
   */
  subscribe(eventType, handler) {
    this.on(eventType, handler);
  }

  /**
   * Publishes an event to every subscribed handler. Each handler is
   * invoked and its result awaited via Promise.allSettled — a
   * rejected/throwing handler is caught and logged here, never
   * propagated to the caller.
   *
   * FIRE-AND-FORGET: callers should invoke this as
   * `eventBusService.publish(EVENT_TYPES.X, payload);` (no await) at
   * their existing success point, exactly like the existing
   * `auditLogRepository.record()` calls elsewhere in this codebase are
   * wrapped in a non-blocking try/catch rather than awaited inline
   * with the main operation. Awaiting is safe (it will not throw) but
   * unnecessary and adds latency to the original request for no
   * benefit.
   */
  async publish(eventType, payload = {}) {
    const handlers = this.listeners(eventType);
    if (handlers.length === 0) return;

    const results = await Promise.allSettled(
      handlers.map((handler) => Promise.resolve().then(() => handler(payload)))
    );

    results.forEach((result, i) => {
      if (result.status === "rejected") {
        // eslint-disable-next-line no-console
        console.error(
          `[eventBusService] Subscriber #${i} for "${eventType}" failed:`,
          result.reason?.message || result.reason
        );
      }
    });
  }
}

// Singleton — every module require()s the same instance, same pattern
// this codebase already uses for supabaseAdmin in config/supabase.js.
module.exports = new EventBusService();
