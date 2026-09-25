/**
 * Closes the cross-process alert-evaluation gap: previously, only a LOCAL
 * tick (mock's "Simulate market tick" button, calling evaluateAlerts()
 * directly in the same request) triggered evaluation. A tick published by
 * a separate ingestion CLI process (via Redis) reached this web server's
 * realtimeBus subscription just fine - the SSE route was already relaying
 * it to browsers - but nothing reacted to it server-side, since alerts
 * live in this process's own memory and evaluation only ever ran from
 * that one route handler.
 *
 * subscribeAlertsToTicks() is called at MODULE SCOPE in
 * app/api/v1/stream/route.ts, not from Next's instrumentation.ts hook.
 * instrumentation.ts looked like the obviously-correct place - Next's own
 * official "run once when the server boots" mechanism - but empirically,
 * it compiles into its own isolated bundle that does NOT share a module
 * singleton with route handlers: a subscription set up there never
 * receives events a route handler's `realtimeBus.publish()` call
 * publishes, even within the same running process. Route handlers DO
 * reliably share module state with each other (that's how the real-time-
 * push feature this reuses works at all), so the fix is to subscribe from
 * a route handler's module scope instead - specifically the SSE route,
 * since every authenticated page already loads it via
 * components/realtime/live-indicator.tsx's EventSource connection.
 *
 * Reacts to EVERY odds_tick on the bus, local or remote, with the same
 * evaluateAlerts() call - exactly once per tick, since module-scope code
 * runs once per process regardless of how many browser tabs later connect
 * to the SSE route. The old direct call from
 * app/api/v1/simulate-tick/route.ts was removed, not left alongside this -
 * keeping both would double-evaluate every local tick, since publishing
 * that tick loops straight back through this same listener.
 */
import { realtimeBus, type RealtimeEvent } from "../realtime/bus";
import { captureException } from "../observability/capture";
import { evaluateAlerts } from "./evaluate";

let subscribed = false;

export function subscribeAlertsToTicks(): void {
  if (subscribed) return; // module-scope code already runs once, but never double-subscribe if this somehow gets called twice
  subscribed = true;

  realtimeBus.subscribe((event: RealtimeEvent) => {
    if (event.type !== "odds_tick") return;
    evaluateAlerts().catch((error) => {
      captureException(error, { source: "tick-listener", event: "odds_tick" });
    });
  });
}
