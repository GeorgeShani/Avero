'use client';

import { useSyncExternalStore } from 'react';
import { readMode, subscribeMode, type ThemeMode } from '../lib/theme';

/** The saved theme choice (system, light or dark), following changes from other tabs. */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeMode, readMode, () => 'system' as ThemeMode);
}
