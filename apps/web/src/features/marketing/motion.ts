/**
 * The motion vocabulary of the marketing page. The two reference sites agree on very little
 * except this: one long ease-out curve for almost everything that moves, a slower ease-in-out for
 * travel across the page, and nothing that animates anything but transform and opacity.
 *
 * The same curves exist as CSS custom properties (`--mk-out`, `--mk-expo`, `--mk-inout`) in
 * marketing.css; the functions here are for the one thing CSS cannot do, the scroll itself.
 */

/** Ease-out with a long tail. This is Lenis's own default, so wheel scrolling and anchor travel decelerate alike. */
export function easeOutExpo(t: number): number {
  return Math.min(1, 1.001 - Math.pow(2, -10 * t));
}

/** Slow start, fast middle, slow end. For moving a long way, such as jumping to another section. */
export function easeInOutQuart(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k < 0.5 ? 8 * k * k * k * k : 1 - Math.pow(-2 * k + 2, 4) / 2;
}

/** The words of a heading, so each can rise out of its own mask. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Turns scroll progress (0 to 1) into a whole step, capped at `max`. Components that only change
 * when the step changes re-render a few dozen times over a scroll instead of on every frame.
 */
export function stepFor(progress: number, divisions: number, max: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return Math.min(max, Math.floor(clamped * divisions));
}
