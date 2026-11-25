import { redirect } from 'next/navigation';

/** Activity is now the Timeline tab of Tasks: it was the same list of tasks seen a second way. */
export default function ActivityPage() {
  redirect('/tasks?view=timeline');
}
