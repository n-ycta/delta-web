import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CoreEvent, Role, Severity } from '@/core/contracts';
import { ROLE_PERMISSIONS, type ConsolePermission } from '@/core/contracts';
import { uid } from '@/core/lib/random';

export type Theme = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'comfortable';

interface Prefs {
  theme: Theme;
  density: Density;
  sidebarCollapsed: boolean;
  /** "view as" — lets the owner preview the console with reduced rights */
  viewAs: Role | null;
  palette: string;
  hour12: boolean;
  homeStrip: boolean;
  set: (p: Partial<Omit<Prefs, 'set'>>) => void;
}

export const usePrefs = create<Prefs>()(persist((set) => ({
  theme: 'system', density: 'comfortable', sidebarCollapsed: false, viewAs: null, palette: 'delta', hour12: false, homeStrip: true,
  set: (p) => set(p),
}), { name: 'delta.console.prefs', version: 1 }));

export interface Toast { id: string; severity: Severity | 'success'; title: string; body?: string; action?: { label: string; run: () => void } }

interface Ui {
  paletteOpen: boolean;
  notificationsOpen: boolean;
  mobileNav: boolean;
  connection: { state: 'open' | 'closed' | 'reconnecting' | 'unknown'; latencyMs?: number; since: number };
  toasts: Toast[];
  live: CoreEvent[];
  set: (p: Partial<Pick<Ui, 'paletteOpen' | 'notificationsOpen' | 'mobileNav'>>) => void;
  setConnection: (c: Ui['connection']) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  pushLive: (e: CoreEvent) => void;
}

export const useUi = create<Ui>((set) => ({
  paletteOpen: false, notificationsOpen: false, mobileNav: false,
  connection: { state: 'unknown', since: Date.now() },
  toasts: [], live: [],
  set: (p) => set(p),
  setConnection: (c) => set((s) => (s.connection.state === c.state && s.connection.latencyMs === c.latencyMs ? s : { connection: { ...c, since: s.connection.state === c.state ? s.connection.since : Date.now() } })),
  toast: (t) => {
    const id = uid('t');
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.severity === 'error' ? 8000 : 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  pushLive: (e) => set((s) => ({ live: [e, ...s.live].slice(0, 100) })),
}));

export const toast = (t: Omit<Toast, 'id'>) => useUi.getState().toast(t);

export function useRole(): Role { return usePrefs((s) => s.viewAs) ?? 'owner'; }
export function useCan(p: ConsolePermission): boolean { const role = useRole(); return ROLE_PERMISSIONS[role].includes(p); }
