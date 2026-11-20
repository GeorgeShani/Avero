'use client';

import { Card, onSoundChange, setSoundEnabled, soundEnabled, Switch } from '@avero/ui';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';

export function SettingsView() {
  const sound = useSyncExternalStore(
    (notify) => onSoundChange(notify),
    soundEnabled,
    () => false,
  );
  return (
    <div data-columns>
      <Card title="Interface" description="Saved in this browser.">
        <div data-stack>
          <Switch
            label="Key sounds"
            defaultChecked={sound}
            key={String(sound)}
            onCheckedChange={(on) => setSoundEnabled(on)}
          />
        </div>
      </Card>
      <Card title="Workspaces" description="Real data">
        <Link data-kit="button" data-tone="primary" href="/workspaces">
          Open workspaces
        </Link>
      </Card>
    </div>
  );
}
