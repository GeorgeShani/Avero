/** A call to the app's own JSON API from the browser: the data, or a message a person can read. */
export async function call<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok)
      return { ok: false, error: body.error ?? `The server answered ${response.status}.` };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}
