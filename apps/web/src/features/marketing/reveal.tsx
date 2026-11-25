'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { useInView } from './hooks';

/**
 * Brings its children into place the first time they scroll into view. What it looks like is
 * decided in marketing.css by what is put on it:
 *
 * - by default the block fades and rises as one;
 * - `stagger` leaves the block still and has each list item (or phase) follow the one before it;
 * - `data-head` is a heading group: the kicker and the paragraphs rise, and the heading's words
 *   come up out of their masks one after another.
 *
 * `delay` shifts the whole thing later, in milliseconds.
 */
export function Reveal({
  delay = 0,
  stagger = false,
  as: Tag = 'div',
  style,
  ...props
}: ComponentProps<'div'> & {
  delay?: number;
  stagger?: boolean;
  as?: 'div' | 'section' | 'li';
}) {
  // A little below the edge, so the reveal is seen, not caught mid-flicker as the block appears.
  const [ref, seen] = useInView<HTMLDivElement>(0.1, 6);
  return (
    <Tag
      ref={ref as never}
      data-mk="reveal"
      data-seen={seen ? '' : undefined}
      data-stagger={stagger ? '' : undefined}
      style={{ ['--delay' as string]: `${delay}ms`, ...style } as CSSProperties}
      {...(props as object)}
    />
  );
}
