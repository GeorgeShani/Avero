'use client';

import { Button } from '@avero/ui';
import { useSyncExternalStore } from 'react';
import { nextMode, readMode, setMode, subscribeMode, type ThemeMode } from '../lib/theme';

const glyph: Record<ThemeMode, string> = { system: '◐', light: '☼', dark: '☾' };
const words: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/** One key that steps through system, light and dark. */
export function ThemeSwitch() {
  const mode = useSyncExternalStore(subscribeMode, readMode, () => 'system' as ThemeMode);
  const next = nextMode[mode];
  return (
    <Button
      round
      data-theme-switch=""
      aria-label={`Theme: ${words[mode]}. Switch to ${words[next]}`}
      title={`Theme: ${words[mode]}`}
      onClick={() => setMode(next)}
    >
      <span aria-hidden="true">{glyph[mode]}</span>
    </Button>
  );
}
