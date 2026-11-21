import { beginGithubInstall } from '../../../../../server/github';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return beginGithubInstall(request);
}
