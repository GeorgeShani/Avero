'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from '../../hooks/use-reduced-motion';

/**
 * True once the element has entered the viewport; stays true afterwards. `bottomMarginPercent`
 * shrinks the viewport at the bottom, so an element is revealed a little after it appears, which
 * reads as deliberate instead of as a flicker at the edge of the screen.
 *
 * IntersectionObserver only reports an element while it crosses the viewport. An element the page
 * jumps clean past (the End key, a dragged scrollbar, a page restored part-way down, a tab that
 * paints slowly) is never reported, and would stay hidden when scrolled back to. So the scroll
 * position is checked as well: anything that starts above the line counts as seen. Without
 * IntersectionObserver the element is simply shown.
 */
export function useInView<T extends Element>(
  threshold = 0.25,
  bottomMarginPercent = 0,
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      // A browser with no way to tell shows the content at once. Deferred, so it is not a state
      // update made while the effect runs.
      const timer = setTimeout(() => setSeen(true), 0);
      return () => clearTimeout(timer);
    }

    let frame = 0;
    const stop = () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
    const reveal = () => {
      setSeen(true);
      stop();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) reveal();
      },
      { threshold, rootMargin: `0px 0px -${bottomMarginPercent}% 0px` },
    );
    const check = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const line = window.innerHeight * (1 - bottomMarginPercent / 100);
      if (rect.top < line - threshold * rect.height) reveal();
    };
    function schedule() {
      if (!frame) frame = requestAnimationFrame(check);
    }
    observer.observe(element);
    window.addEventListener('scroll', schedule, { passive: true });
    return stop;
  }, [seen, threshold, bottomMarginPercent]);
  return [ref, seen];
}

/**
 * A value derived from how far through an element the page has scrolled: 0 when its top reaches
 * the top of the viewport, 1 when its bottom reaches the bottom. `select` turns that fraction into
 * what the component actually uses (a step, a boolean), and React re-renders only when that value
 * changes, not on every scroll frame. With smooth scrolling the frames come at the display rate,
 * so re-rendering on each one is the difference between smooth and not.
 */
export function useScrollProgress<T>(
  ref: RefObject<Element | null>,
  select: (progress: number) => T,
): T {
  const choose = useRef(select);
  const [value, setValue] = useState<T>(() => select(0));
  // Keeps the latest `select` without re-subscribing to the scroll each time it changes.
  useEffect(() => {
    choose.current = select;
  });
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const range = rect.height - window.innerHeight;
      setValue(choose.current(range > 0 ? Math.min(1, Math.max(0, -rect.top / range)) : 0));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
  return value;
}

/** Eases a number toward its target. With reduced motion it jumps straight there. */
export function useTween(target: number, duration = 650): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced) {
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const next = origin + (target - origin) * eased;
      from.current = next;
      setValue(next);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);
  return reduced ? target : value;
}
