/**
 * Register Subscribers
 * ------------------------------------------------------------------
 * Sprint 14. Wires notificationService.handleEvent and
 * activityService.handleEvent to every EVENT_TYPES value on
 * eventBusService. Called exactly once at boot (see app.js) — this is
 * the one place that knows both subscribers exist and both care about
 * every event type; individual modules publishing events don't need
 * to know or care who's listening.
 *
 * If a future sprint adds a subscriber that only cares about a subset
 * of events (e.g. an email digest service that only cares about
 * *_approved/*_rejected events), it gets its own targeted
 * eventBusService.subscribe() calls added here — this function is the
 * single wiring point, not each subscriber registering itself on
 * import (which would make "what listens to what" hard to audit from
 * one place).
 */

const eventBusService = require("../services/eventBusService");
const notificationService = require("../services/notificationService");
const activityService = require("../services/activityService");
const { EVENT_TYPES } = require("./eventTypes");

let registered = false;

function registerSubscribers() {
  if (registered) {
    // Guards against double-registration if this is ever accidentally
    // require()'d/called twice (e.g. hot-reload in dev) — without
    // this, every event would fire each handler N times.
    console.warn("[registerSubscribers] Already registered — skipping duplicate registration.");
    return;
  }

  const eventTypeValues = Object.values(EVENT_TYPES);

  for (const eventType of eventTypeValues) {
    eventBusService.subscribe(eventType, (payload) => notificationService.handleEvent(eventType, payload));
    eventBusService.subscribe(eventType, (payload) => activityService.handleEvent(eventType, payload));
  }

  registered = true;
  console.log(`[registerSubscribers] Registered notificationService + activityService for ${eventTypeValues.length} event types.`);
}

module.exports = { registerSubscribers };
