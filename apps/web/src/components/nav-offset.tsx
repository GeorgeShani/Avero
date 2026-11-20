'use client';

import { useEffect } from 'react';

/**
 * Keeps the space the page reserves under the fixed navbar equal to the bar's real height.
 *
 * The skin pads the site root by `var(--nav-h)`, but nothing sets it, and on a narrow screen the
 * bar wraps its links onto a second row and grows past the 52px the CSS assumes, covering the top
 * of the page. This measures the bar and writes `--nav-h` on the site root. The navbar lives in
 * the route-group layouts, so it can mount, unmount and be replaced as you navigate; the observer
 * follows whichever bar is there.
 */
export function NavOffset() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-site]');
    if (!root) return;
    let bar: Element | null = null;
    const apply = () => {
      if (bar instanceof HTMLElement) root.style.setProperty('--nav-h', `${bar.offsetHeight}px`);
      else root.style.removeProperty('--nav-h');
    };
    const resizes = new ResizeObserver(apply);
    const find = () => {
      const next = root.querySelector(':scope > [data-kit="navbar"]');
      if (next === bar) return;
      if (bar) resizes.unobserve(bar);
      bar = next;
      if (bar) resizes.observe(bar);
      apply();
    };
    const children = new MutationObserver(find);
    children.observe(root, { childList: true });
    find();
    return () => {
      resizes.disconnect();
      children.disconnect();
      root.style.removeProperty('--nav-h');
    };
  }, []);
  return null;
}
