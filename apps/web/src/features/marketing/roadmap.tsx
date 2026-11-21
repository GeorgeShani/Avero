'use client';

import { Reveal } from './reveal';
import { phases } from './run-data';

/** All the phases at once, so the order and what is next are visible without clicking. */
export function Roadmap() {
  return (
    <ol data-mk="roadmap" aria-label="Roadmap phases">
      {phases.map((phase, index) => (
        <Reveal as="li" key={phase.id} delay={index * 70}>
          <article data-mk="phase" data-state={phase.state}>
            <span data-mk="phase-no" aria-hidden="true">
              {phase.id}
            </span>
            <span data-mk="phase-state" data-state={phase.state}>
              {phase.state}
            </span>
            <h3>{phase.name}</h3>
            <p>{phase.body}</p>
          </article>
        </Reveal>
      ))}
    </ol>
  );
}
