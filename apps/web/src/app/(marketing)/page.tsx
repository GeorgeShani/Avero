import Link from 'next/link';
import { AgentDesk } from '../../components/marketing/agent-desk';
import { BenchDemo } from '../../components/marketing/bench-demo';
import { HeroScope } from '../../components/marketing/hero-scope';
import { RecorderStory } from '../../components/marketing/recorder-story';
import { Reveal } from '../../components/marketing/reveal';
import { Roadmap } from '../../components/marketing/roadmap';
import { TypedLine } from '../../components/marketing/typed-line';
import { VerdictDemo } from '../../components/marketing/verdict-demo';

const headline = ['See', 'what', 'your', 'coding', 'agents', 'actually', 'did.'];

const doors = [
  { href: '/overview', title: 'Overview', body: 'Approvals, live runs and the activity feed' },
  { href: '/tasks', title: 'Tasks', body: 'A board, a composer and a workspace per task' },
  {
    href: '/repositories',
    title: 'Repositories',
    body: 'What each repository allows agents to do',
  },
  { href: '/agents', title: 'Agents', body: 'The agents and the rules they run under' },
  { href: '/evaluations', title: 'Evaluations', body: 'Compare setups on the same tasks' },
] as const;

export default function MarketingPage() {
  return (
    <>
      <section data-mk="hero" aria-labelledby="hero-title">
        <p data-mk="status">
          <span data-mk="lamp" data-live="" /> In development · the demos below use example data
        </p>
        <div data-mk="hero-top">
          <h1 id="hero-title" data-mk="headline">
            {headline.map((word, index) => (
              <span key={word + index} style={{ ['--i' as string]: index }}>
                {word}
              </span>
            ))}
          </h1>
          <div data-mk="hero-side">
            <p data-mk="lede">
              Avero records every Cursor agent run, replays it step by step, checks it against what
              you asked for, and tells you which setup works best on your repository.
            </p>
            <div data-mk="cta">
              <Link data-kit="button" data-tone="primary" href="/overview">
                Try the console demo
              </Link>
              <a data-kit="button" data-tone="secondary" href="#recorder">
                How it works
              </a>
            </div>
            <TypedLine
              text='npx avero run "fix the flaky retry test"'
              caption="Planned command. Not published yet."
            />
          </div>
        </div>
        <HeroScope />
      </section>

      <RecorderStory />

      <section id="verdict" data-mk="section" aria-labelledby="verdict-title">
        <Reveal data-head="">
          <p data-mk="kicker">02 · Verdict</p>
          <h2 id="verdict-title">Review the evidence, not just the diff.</h2>
          <p data-mk="lede">
            Reviewing agent work means rebuilding the task from the code. An independent reviewer
            agent does that first, so you start from a checked list.
          </p>
        </Reveal>
        <VerdictDemo />
      </section>

      <section id="bench" data-mk="section" aria-labelledby="bench-title">
        <Reveal data-head="">
          <p data-mk="kicker">03 · Bench</p>
          <h2 id="bench-title">Find the best setup for your repository, per dollar.</h2>
          <p data-mk="lede">
            Your merged pull requests become tasks. Avero runs them across models, effort levels and
            rules, then reports the cost of each resolved task.
          </p>
        </Reveal>
        <BenchDemo />
      </section>

      <section data-mk="section" aria-labelledby="share-title">
        <Reveal data-head="">
          <p data-mk="kicker">04 · Share</p>
          <h2 id="share-title">Send a replay, not a screenshot.</h2>
          <p data-mk="lede">
            Export one self-contained, redacted file that plays the whole run in any browser.
            Records are plain files, and Avero plans to write the open Agent Trace format for
            attribution.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <ul data-mk="chips" aria-label="Where Avero plans to meet your work">
            {[
              'Cursor SDK',
              'Agent SDK',
              'GitHub',
              'Slack',
              'Webhooks',
              'Schedules',
              'OpenTelemetry',
              'MCP',
            ].map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section id="agents" data-mk="section" aria-labelledby="agents-title">
        <Reveal data-head="">
          <p data-mk="kicker">05 · Agents</p>
          <h2 id="agents-title">Built to be operated by agents, too.</h2>
          <p data-mk="lede">
            Every control on this page tells an agent what it is, what it holds and what it can do.
            There are no screenshots and no simulated clicks: the agent reads state and calls
            actions directly. Pick a task and watch it work the page above.
          </p>
        </Reveal>
        <AgentDesk />
        <p data-mk="aside">
          Planned: the Avero console exposes the same tools, so an agent can start a run, read a
          verdict and ask for your approval.
        </p>
      </section>

      <section id="roadmap" data-mk="section" aria-labelledby="roadmap-title">
        <Reveal data-head="">
          <p data-mk="kicker">Roadmap</p>
          <h2 id="roadmap-title">Where this is going, in order.</h2>
          <p data-mk="lede">
            Local-first first: one command and one API key. A hosted team workspace comes after,
            over the same record format.
          </p>
        </Reveal>
        <Roadmap />
      </section>

      <section data-mk="closing" aria-labelledby="closing-title">
        <div data-mk="closing-copy">
          <p data-mk="kicker">The console</p>
          <h2 id="closing-title">The workspace is already running.</h2>
          <p data-mk="lede">
            Drive simulated runs with the D-pad, approve them and open their workspaces. It is a
            prototype of the interface, not a recording of real agents.
          </p>
          <Link data-kit="button" data-tone="primary" href="/overview">
            Open the console demo
          </Link>
        </div>
        <ul data-mk="doors" aria-label="Console screens">
          {doors.map((door) => (
            <li key={door.href}>
              <Link data-mk="door" href={door.href}>
                <strong>{door.title}</strong>
                <span>{door.body}</span>
                <i aria-hidden="true">→</i>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
