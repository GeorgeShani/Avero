import { receiveGithubWebhook } from '../../../../../server/github';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return receiveGithubWebhook(request);
}
