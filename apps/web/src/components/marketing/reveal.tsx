'use client';

import type { ComponentProps, CSSProperties } from 'react';
import { useInView } from './hooks';

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({
  delay = 0,
  as: Tag = 'div',
  style,
  ...props
}: ComponentProps<'div'> & { delay?: number; as?: 'div' | 'section' | 'li' }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.15);
  return (
    <Tag
      ref={ref as never}
      data-mk="reveal"
      data-seen={seen ? '' : undefined}
      style={{ ['--delay' as string]: `${delay}ms`, ...style } as CSSProperties}
      {...(props as object)}
    />
  );
}
