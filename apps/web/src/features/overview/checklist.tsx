import Link from 'next/link';
import { CopyCommand } from '../../components/console/copy-command';
import type { SetupStep, StepState } from './setup-status';

const view: Record<StepState, { glyph: string; word: string; tone: string }> = {
  done: { glyph: '✓', word: 'Done', tone: 'ok' },
  next: { glyph: '→', word: 'Do this next', tone: 'warn' },
  later: { glyph: '○', word: 'Later', tone: 'quiet' },
  blocked: { glyph: '⊘', word: 'Not available here', tone: 'warn' },
};

/**
 * Steps toward a working setup. Each says what it is, why, and exactly what to do: a command to
 * copy or a page to open. A finished step stays visible, so progress is not a surprise.
 */
export function Checklist({ steps, label }: { steps: readonly SetupStep[]; label: string }) {
  return (
    <ol data-checklist aria-label={label}>
      {steps.map((step) => {
        const tag = view[step.state];
        return (
          <li key={step.id} data-step={step.state}>
            <span data-tag data-tone={tag.tone}>
              <i aria-hidden="true">{tag.glyph}</i>
              {tag.word}
            </span>
            <div data-check-main>
              <strong>
                {step.title}
                {step.optional ? <span data-faint> · optional</span> : null}
              </strong>
              <p>{step.detail}</p>
              {step.state !== 'done' && step.command ? (
                <CopyCommand command={step.command} />
              ) : null}
              {step.state !== 'done' && step.href ? (
                <Link
                  href={step.href}
                  data-btn
                  data-primary={step.state === 'next' ? '' : undefined}
                >
                  {step.hrefLabel ?? 'Open'}
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
