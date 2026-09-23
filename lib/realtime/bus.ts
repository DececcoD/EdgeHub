/**
 * Pub/sub for pushing real-time odds updates to connected browsers
 * (Section 7.1) - the "real-time push" this project previously stood in
 * for with a manual "Simulate market tick" button that only refreshed the
 * clicking browser's own tab.
 *
 * Two implementations behind one interface, selected by whether
 * REDIS_URL is set:
 *  - InProcessBus (default): a plain EventEmitter. Works for mock mode and
 *    any single-instance deployment, since the publisher and every
 *    subscriber share one Node process's memory.
 *  - RedisBus: the only way this can work across processes. The ingestion
 *    CLI (scripts/ingest.ts) and the running web server are ALWAYS
 *    separate processes - an in-memory emitter can never bridge that, no
 *    matter how the app itself is deployed. Multiple web server instances
 *    behind a load balancer have the same problem even for mock mode's
 *    tick button. Redis pub/sub is the standard fix for both.
 */
import { EventEmitter } from "node:events";
import Redis from "ioredis";

export interface OddsTickEvent {
  type: "odds_tick";
  affectedMarkets: number;
  affectedOutcomes: number;
  at: string;
}

/**
 * Unlike OddsTickEvent (public market data - safe to broadcast to every
 * connected browser), this carries one user's private alert content. It
 * still goes over the same shared bus/channel rather than a separate
 * per-user one - simpler, and fine at this scale - but the SSE route
 * (app/api/v1/stream/route.ts) MUST filter these by `userId` against the
 * requesting browser's own session before forwarding, or one user's
 * alerts would leak to every other open tab.
 */
export interface AlertFiredEvent {
  type: "alert_fired";
  userId: string;
  alertId: string;
  subjectLabel: string;
  message: string;
  at: string;
}

export type RealtimeEvent = OddsTickEvent | AlertFiredEvent;

export interface RealtimeBus {
  publish(event: RealtimeEvent): Promise<void>;
  /** Returns an unsubscribe function. */
  subscribe(onEvent: (event: RealtimeEvent) => void): () => void;
}

const CHANNEL = "edgehub:odds_tick";

class InProcessBus implements RealtimeBus {
  private emitter = new EventEmitter();

  async publish(event: RealtimeEvent): Promise<void> {
    this.emitter.emit(CHANNEL, event);
  }

  subscribe(onEvent: (event: RealtimeEvent) => void): () => void {
    this.emitter.on(CHANNEL, onEvent);
    return () => this.emitter.off(CHANNEL, onEvent);
  }
}

class RedisBus implements RealtimeBus {
  private publisher: Redis;
  private subscriberByListener = new Map<(event: RealtimeEvent) => void, Redis>();

  constructor(url: string) {
    this.publisher = new Redis(url);
  }

  async publish(event: RealtimeEvent): Promise<void> {
    await this.publisher.publish(CHANNEL, JSON.stringify(event));
  }

  subscribe(onEvent: (event: RealtimeEvent) => void): () => void {
    // A Redis client in subscribe mode can't issue other commands, so
    // every subscriber gets its own dedicated connection rather than
    // sharing the publisher's.
    const client = this.publisher.duplicate();
    const handler = (_channel: string, message: string) => {
      try {
        onEvent(JSON.parse(message) as RealtimeEvent);
      } catch {
        // malformed message from some other publisher on this channel - ignore rather than crash the stream
      }
    };

    client.subscribe(CHANNEL).catch((error) => console.error("RedisBus subscribe failed:", error));
    client.on("message", handler);
    this.subscriberByListener.set(onEvent, client);

    return () => {
      client.off("message", handler);
      client.unsubscribe(CHANNEL).catch(() => {});
      client.disconnect();
      this.subscriberByListener.delete(onEvent);
    };
  }
}

function createBus(): RealtimeBus {
  const url = process.env.REDIS_URL;
  return url ? new RedisBus(url) : new InProcessBus();
}

// Module-level singleton: every route/component that imports this gets the
// same bus instance within one process, which is what makes the
// InProcessBus case work at all.
export const realtimeBus: RealtimeBus = createBus();
