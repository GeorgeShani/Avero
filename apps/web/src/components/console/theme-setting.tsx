'use client';

import { useSyncExternalStore } from 'react';
import { readMode, setMode, subscribeMode, type ThemeMode } from '../../lib/theme';

const modes: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

/** Theme choice. It is saved in this browser and shared with the site's own theme key. */
export function ThemeSetting() {
  const mode = useSyncExternalStore(subscribeMode, readMode, () => 'system' as ThemeMode);
  return (
    <div data-seg role="group" aria-label="Theme">
      {modes.map((choice) => (
        <button
          key={choice.id}
          type="button"
          aria-pressed={mode === choice.id}
          onClick={() => setMode(choice.id)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
