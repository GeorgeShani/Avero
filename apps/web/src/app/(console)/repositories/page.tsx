import type { Metadata } from 'next';
import { RepositoriesView } from '../../../components/simple-pages';

export const metadata: Metadata = { title: 'Repositories' };

export default function Page() {
  return (
    <>
      <div data-page-head>
        <div>
          <h1>Repositories</h1>
          <p>
            Repositories connected through the GitHub App, with their recent engineering activity.
          </p>
        </div>
      </div>
      <RepositoriesView />
    </>
  );
}
