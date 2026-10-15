import { useEffect, useState } from 'react';
import { usePrefs } from './stores';

export function useResolvedTheme(): 'light' | 'dark' {
  const theme = usePrefs((s) => s.theme);
  const [sys, setSys] = useState(() => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSys(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return theme === 'system' ? (sys as 'light' | 'dark') : theme;
}

/** Data palettes. Chosen for distinguishability on both paper and graphite backgrounds, without neon. */
export const PALETTES: Record<string, { label: string; light: string[]; dark: string[] }> = {
  delta: { label: 'Delta', light: ['#1F4E79', '#D9480F', '#5E7D2A', '#A86F12', '#6B4C8A', '#2C7A72', '#8A3B4A', '#6D6A62'], dark: ['#7FA8D6', '#F27A3E', '#93B85A', '#D9AA4A', '#A88BC8', '#5FB3A8', '#D07A8A', '#A8A397'] },
  ink: { label: 'Чернила', light: ['#1A1A18', '#5B5850', '#8F8A7F', '#B9B3A6', '#D9480F', '#3E3C37'], dark: ['#ECEAE3', '#B4B0A6', '#827E75', '#57544E', '#F26B2B', '#D5D1C8'] },
  contrast: { label: 'Контраст', light: ['#0057B8', '#E03C00', '#00875A', '#B8860B', '#8E24AA', '#00838F'], dark: ['#4DA3FF', '#FF7043', '#2ECC8F', '#FFC94D', '#CE7BE0', '#4DD0E1'] },
  earth: { label: 'Земля', light: ['#7A4E2D', '#4F6D3A', '#B5833A', '#3F5E6E', '#9C4A36', '#6E6450'], dark: ['#C99A72', '#9DBB7E', '#E2B56C', '#86AFC2', '#D88A72', '#B5AA90'] },
};

export function useChartColors(paletteOverride?: string) {
  const theme = useResolvedTheme();
  const pref = usePrefs((s) => s.palette);
  const p = PALETTES[paletteOverride ?? pref] ?? PALETTES.delta;
  const dark = theme === 'dark';
  return {
    series: dark ? p.dark : p.light,
    grid: dark ? '#262523' : '#E6E2D9',
    axis: dark ? '#7B776E' : '#8F8A7F',
    ink: dark ? '#ECEAE3' : '#1A1A18',
    muted: dark ? '#5F5C55' : '#A7A296',
    warn: dark ? '#D7A443' : '#A86F12',
    err: dark ? '#E8634F' : '#BC3424',
    ok: dark ? '#5BB07D' : '#2E7A4C',
    surface: dark ? '#191918' : '#FBFAF7',
    sunken: dark ? '#0C0C0B' : '#EAE7E0',
    dark,
  };
}
