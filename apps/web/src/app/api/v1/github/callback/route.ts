import { completeGithubInstall } from '../../../../../server/github';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return completeGithubInstall(request);
}
