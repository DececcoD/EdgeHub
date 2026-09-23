/**
 * Server-Sent Events, not WebSockets: this is a one-directional server->
 * browser push (odds ticks, alert notifications), which is all SSE does
 * and all this needs - no client->server messages ever flow over this
 * channel. SSE is a plain Route Handler returning a streamed Response, so
 * it needs no custom server.js or `ws` upgrade handling, unlike
 * WebSockets in the App Router.
 */
import { realtimeBus, type RealtimeEvent } from "@/lib/realtime/bus";
import { getSessionOrDemo } from "@/lib/auth/session";
import { subscribeAlertsToTicks } from "@/lib/alerts/tick-listener";

export const dynamic = "force-dynamic";

// Module-scope, not inside GET: runs exactly once, the first time any
// request loads this route module, not once per connection. This is
// deliberately NOT done via instrumentation.ts (Next's official one-time
// startup hook) - verified empirically that instrumentation.ts compiles
// into its own isolated bundle that does NOT share a module singleton
// with route handlers, so a subscription set up there never actually
// receives events published from a route handler's `realtimeBus.publish()`
// call, even within the same running process. Route handlers DO reliably
// share module state with each other (proven by the real-time-push
// feature this alert evaluation reuses), so this route - which every
// authenticated page already loads via components/realtime/live-indicator.tsx's
// EventSource connection - is where the subscription actually needs to live.
subscribeAlertsToTicks();

const HEARTBEAT_MS = 20000; // keeps idle proxies/load balancers from timing out the connection

export async function GET() {
  const session = await getSessionOrDemo();
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RealtimeEvent) => {
        // odds_tick is public market data - every connection gets it.
        // alert_fired is one user's private content - only forward it to
        // that same user's own connection, never to anyone else's.
        if (event.type === "alert_fired" && event.userId !== session.userId) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Without an immediate chunk, nothing flushes to the client - not
      // even the response headers - until either a real tick happens or
      // the first heartbeat fires, up to HEARTBEAT_MS later. That left the
      // browser's EventSource sitting in "connecting" for up to 20s with
      // no way to tell it apart from a genuinely broken connection.
      controller.enqueue(encoder.encode(`: connected\n\n`));

      unsubscribe = realtimeBus.subscribe(send);
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(`: ping\n\n`)), HEARTBEAT_MS);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
