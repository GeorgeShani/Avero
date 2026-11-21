const maxThinkingChars = 4_000;

type Event = Record<string, unknown>;

/**
 * The SDK streams assistant text and thinking a few characters at a time. Left alone that
 * would put hundreds of events in a record for one sentence, so consecutive pieces of the same
 * kind are joined into one event, written when something else happens or the run ends.
 */
export function createCoalescer(emit: (event: Event) => void) {
  let pending: { type: 'assistant' | 'thinking'; text: string; durationMs?: number } | undefined;

  function flush() {
    if (!pending) return;
    const { type, text, durationMs } = pending;
    pending = undefined;
    const kept = type === 'thinking' ? text.slice(0, maxThinkingChars) : text;
    if (type === 'assistant' && kept === '') return;
    emit({
      type,
      ...(kept ? { text: kept } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
    });
  }

  function push(event: Event) {
    const type = event.type;
    if (type !== 'assistant' && type !== 'thinking') {
      flush();
      emit(event);
      return;
    }
    if (pending?.type !== type) {
      flush();
      pending = { type, text: '' };
    }
    pending.text += typeof event.text === 'string' ? event.text : '';
    if (typeof event.durationMs === 'number') {
      pending.durationMs = (pending.durationMs ?? 0) + event.durationMs;
    }
  }

  return { push, flush };
}
