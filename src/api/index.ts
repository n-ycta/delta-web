import type { CoreApi } from './types';
import { MockCoreAdapter } from './mock/MockCoreAdapter';
import { HttpCoreAdapter } from './http/HttpCoreAdapter';

export * from './types';

export interface ConnectionSettings { mode: 'mock' | 'http'; baseUrl: string; token?: string }

const KEY = 'delta.console.connection';

export function readConnectionSettings(): ConnectionSettings {
  const env = { mode: (import.meta.env.VITE_CORE_MODE as 'mock' | 'http') ?? 'http', baseUrl: (import.meta.env.VITE_CORE_URL as string) ?? '/api' };
  try { return { ...env, ...JSON.parse(localStorage.getItem(KEY) ?? '{}'), token: sessionStorage.getItem(KEY + '.token') ?? undefined }; } catch { return env; }
}
export function writeConnectionSettings(s: ConnectionSettings) {
  // Keep user API secrets out of persistent localStorage and configuration exports.
  const { token, ...settings } = s; localStorage.setItem(KEY, JSON.stringify(settings));
  if (token) sessionStorage.setItem(KEY + '.token', token); else sessionStorage.removeItem(KEY + '.token');
}

/** Adapter factory — the single place where the transport is chosen. */
export function createCoreApi(s: ConnectionSettings = readConnectionSettings()): CoreApi {
  return s.mode === 'http' ? new HttpCoreAdapter({ baseUrl: s.baseUrl, token: s.token }) : new MockCoreAdapter();
}
