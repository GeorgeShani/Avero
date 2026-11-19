'use client';

import { useEffect, useState } from 'react';
import { useInView, useReducedMotion } from './hooks';

/** Types a command once, when it scrolls into view. */
export function TypedLine({ text, caption }: { text: string; caption: string }) {
  const reduced = useReducedMotion();
  const [ref, seen] = useInView<HTMLDivElement>(0.5);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!seen || reduced) return;
    const id = setInterval(() => {
      setCount((value) => {
        if (value >= text.length) {
          clearInterval(id);
          return value;
        }
        return value + 1;
      });
    }, 42);
    return () => clearInterval(id);
  }, [seen, reduced, text]);

  const visible = reduced ? text : text.slice(0, count);
  return (
    <div ref={ref} data-mk="typed">
      <code aria-label={text}>
        <span aria-hidden="true">
          $ {visible}
          <i data-mk="caret" />
        </span>
      </code>
      <small>{caption}</small>
    </div>
  );
}
