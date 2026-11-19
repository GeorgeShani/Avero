'use client';

import { themeStorageKey } from './theme-boot';

export type ThemeMode = 'system' | 'light' | 'dark';

const darkQuery = '(prefers-color-scheme: dark)';
const listeners = new Set<() => void>();

export function readMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return window.matchMedia(darkQuery).matches ? 'dark' : 'light';
  return mode;
}

function apply(mode: ThemeMode) {
  document.documentElement.dataset.skinTheme = resolveTheme(mode);
}

export function setMode(mode: ThemeMode) {
  try {
    if (mode === 'system') localStorage.removeItem(themeStorageKey);
    else localStorage.setItem(themeStorageKey, mode);
  } catch {
    // Storage can be blocked; the choice still applies until the page is closed.
  }
  apply(mode);
  listeners.forEach((listener) => listener());
}

/** Follows the system setting while the mode is "system", and other tabs' choices. */
export function subscribeMode(listener: () => void): () => void {
  listeners.add(listener);
  const media = window.matchMedia(darkQuery);
  const onSystem = () => {
    if (readMode() === 'system') apply('system');
    listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === themeStorageKey || event.key === null) {
      apply(readMode());
      listener();
    }
  };
  media.addEventListener('change', onSystem);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', onSystem);
    window.removeEventListener('storage', onStorage);
  };
}

export const nextMode: Record<ThemeMode, ThemeMode> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};
