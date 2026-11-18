import type { Metadata } from 'next';
import { SettingsView } from '../../../components/simple-pages';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Settings</h1>
          <p>Workspace and interface preferences.</p>
        </div>
      </div>
      <SettingsView />
    </>
  );
}
