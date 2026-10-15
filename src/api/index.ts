import type { CoreApi } from './types';
import { MockCoreAdapter } from './mock/MockCoreAdapter';
import { HttpCoreAdapter } from './http/HttpCoreAdapter';

export * from './types';

export interface ConnectionSettings { mode: 'mock' | 'http'; baseUrl: string; token?: string }

const KEY = 'delta.console.connection';

export function readConnectionSettings(): ConnectionSettings {
  const env = { mode: (import.meta.env.VITE_CORE_MODE as 'mock' | 'http') ?? 'mock', baseUrl: (import.meta.env.VITE_CORE_URL as string) ?? 'http://localhost:7340/api/v1' };
  try { return { ...env, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return env; }
}
export function writeConnectionSettings(s: ConnectionSettings) { localStorage.setItem(KEY, JSON.stringify(s)); }

/** Adapter factory — the single place where the transport is chosen. */
export function createCoreApi(s: ConnectionSettings = readConnectionSettings()): CoreApi {
  return s.mode === 'http' ? new HttpCoreAdapter({ baseUrl: s.baseUrl, token: s.token }) : new MockCoreAdapter();
}
