'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A command to run in a terminal, with a button that copies it. If the browser refuses (a page
 * that is not secure, or no permission), it says so, and the text stays selectable.
 */
export function CopyCommand({ command, label }: { command: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2500);
  };

  return (
    <div data-copy>
      <pre data-cmd tabIndex={0} aria-label={label}>
        {command}
      </pre>
      <button
        type="button"
        data-btn
        onClick={() => void copy()}
        aria-label={label ? `Copy ${label}` : 'Copy command'}
      >
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy' : 'Copy'}
      </button>
      <span data-sr role="status">
        {state === 'copied' ? 'Copied to the clipboard' : ''}
      </span>
    </div>
  );
}
