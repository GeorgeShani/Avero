import type { Metadata } from 'next';
import { AgentsView } from '../../../components/simple-pages';

export const metadata: Metadata = { title: 'Agents' };

export default function Page() {
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Agents</h1>
          <p>Agent definitions with their role, tools and version.</p>
        </div>
      </div>
      <AgentsView />
    </>
  );
}
