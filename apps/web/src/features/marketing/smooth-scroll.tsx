'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';
import { easeInOutQuart } from './motion';

const reduced = '(prefers-reduced-motion: reduce)';

/** The space under the fixed navbar, so a section scrolled to is not hidden behind it. */
function navbarClearance(): number {
  const bar = document.querySelector('[data-kit="navbar"]');
  return (bar ? bar.getBoundingClientRect().bottom : 0) + 12;
}

/** Moves keyboard focus to where the page scrolled to, without moving the page. */
function focusSection(target: HTMLElement) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/**
 * Inertial scrolling for the marketing page: the wheel moves a target and the page eases toward it,
 * which is what makes the page feel like it has weight. It does nothing for someone who asked for
 * reduced motion (they keep the browser's own scrolling, live, without a reload), and it leaves
 * touch alone, because a phone's own momentum scrolling is already the one people expect.
 *
 * Links to a section of the page (the navbar's and the page's own) glide there on a slow in-out
 * curve instead of jumping, then focus lands on the section so a keyboard user is not left behind.
 */
export function SmoothScroll() {
  useEffect(() => {
    const media = window.matchMedia(reduced);
    let lenis: Lenis | undefined;

    const sync = () => {
      if (media.matches) {
        lenis?.destroy();
        lenis = undefined;
      } else if (!lenis) {
        lenis = new Lenis({
          autoRaf: true,
          lerp: 0.085,
          allowNestedScroll: true,
          // The jsonl and tape panels scroll on their own; the wheel over them must scroll them.
          prevent: (node) => node.hasAttribute('data-lenis-prevent'),
        });
      }
    };

    const onClick = (event: MouseEvent) => {
      if (!lenis || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;
      event.preventDefault();
      lenis.scrollTo(target, {
        offset: -navbarClearance(),
        duration: 1.5,
        easing: easeInOutQuart,
        onComplete: () => focusSection(target),
      });
      // Keep the address in step without adding a history entry the back button would stall on.
      history.replaceState(history.state, '', link.hash);
    };

    sync();
    media.addEventListener('change', sync);
    document.addEventListener('click', onClick);
    return () => {
      media.removeEventListener('change', sync);
      document.removeEventListener('click', onClick);
      lenis?.destroy();
    };
  }, []);

  return null;
}
