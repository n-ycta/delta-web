import { z } from 'zod';
import { Severity } from './common';

export const EventSource = z.object({ type: z.enum(['node', 'plugin', 'core', 'auth', 'console']), id: z.string(), label: z.string().optional() });
export const CoreEvent = z.object({
  id: z.string(),
  ts: z.number(),
  severity: Severity,
  source: EventSource,
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type CoreEvent = z.infer<typeof CoreEvent>;

export const Notification = z.object({
  id: z.string(),
  ts: z.number(),
  severity: Severity,
  title: z.string(),
  body: z.string().optional(),
  read: z.boolean(),
  link: z.string().optional(),
  eventId: z.string().optional(),
});
export type Notification = z.infer<typeof Notification>;

export interface EventQuery {
  severities?: Severity[];
  sourceTypes?: string[];
  sourceId?: string;
  text?: string;
  limit?: number;
  before?: number;
}

/** Messages pushed from core to the console over the realtime channel. */
export type RealtimeMessage =
  | { type: 'event'; event: CoreEvent }
  | { type: 'node.update'; nodeId: string; patch: Partial<import('./node').NodeInfo> }
  | { type: 'plugin.update'; pluginId: string }
  | { type: 'notification'; notification: Notification }
  | { type: 'connection'; state: 'open' | 'closed' | 'reconnecting'; latencyMs?: number };
