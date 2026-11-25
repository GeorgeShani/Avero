import { Fragment } from 'react';
import { splitWords } from './motion';

/**
 * A heading's words, each inside its own clipping mask so it can rise into view from below the
 * line (the stagger comes from `--i`). The words stay ordinary inline text separated by real
 * spaces, so a screen reader reads the heading as one sentence and copying it gives plain text.
 */
export function Words({ text, start = 0 }: { text: string; start?: number }) {
  return (
    <>
      {splitWords(text).map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          {index > 0 ? ' ' : null}
          <span data-mk="w">
            <span data-mk="wi" style={{ ['--i' as string]: start + index }}>
              {word}
            </span>
          </span>
        </Fragment>
      ))}
    </>
  );
}
