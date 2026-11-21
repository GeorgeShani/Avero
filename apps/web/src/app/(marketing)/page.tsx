import Link from 'next/link';
import { AgentDesk } from '../../components/marketing/agent-desk';
import { BenchDemo } from '../../components/marketing/bench-demo';
import { exampleRecord, recordLinesFrom } from '../../components/marketing/example';
import { RecorderStory } from '../../components/marketing/recorder-story';
import { Reveal } from '../../components/marketing/reveal';
import { ReplayScope } from '../../components/runs/replay-scope';
import { Roadmap } from '../../components/marketing/roadmap';
import { TypedLine } from '../../components/marketing/typed-line';
import { VerdictDemo } from '../../components/marketing/verdict-demo';

const headline = ['See', 'what', 'your', 'coding', 'agents', 'actually', 'did.'];

const doors = [
  {
    href: '/overview',
    title: 'Desk',
    body: 'Totals, what needs your decision, the latest bench result',
  },
  { href: '/runs', title: 'Runs', body: 'Every recorded run, with its replay and diff' },
  { href: '/review', title: 'Review', body: 'Finished runs waiting for you, riskiest first' },
  { href: '/bench', title: 'Bench', body: 'Which model and rules resolve the most tasks' },
] as const;

const shipped = [
  {
    title: 'One-file replay',
    body: 'A single HTML file that plays the whole run offline. Known secret formats are redacted; read it before you send it.',
    command: 'avero export <run-id>',
  },
  {
    title: 'Agent Trace',
    body: 'The lines the agent added, in the open Agent Trace format, for tools that read attribution.',
    command: 'avero trace <run-id>',
  },
  {
    title: 'Local viewer',
    body: 'A read-only page on your own machine with every run. No account, nothing to host.',
    command: 'avero serve',
  },
  {
    title: 'MCP server',
    body: 'Six read-only tools, so your own agent can list runs, read a verdict and search them.',
    command: 'avero mcp',
  },
] as const;

const start = [
  { step: 'Record', command: 'avero run "fix the flaky retry test" --max-tokens 200000' },
  { step: 'Review', command: 'avero verdict <run-id>' },
  { step: 'Compare', command: 'avero bench init --repo . --test "npm test"' },
] as const;

export default function MarketingPage() {
  return (
    <>
      <section data-mk="hero" aria-labelledby="hero-title">
        <p data-mk="status">
          <span data-mk="lamp" data-live="" /> Built and run on real Cursor agents · the replay, the
          verdict and the bench result on this page are real recordings
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
                Open the console
              </Link>
              <a data-kit="button" data-tone="secondary" href="#recorder">
                How it works
              </a>
            </div>
            <TypedLine
              text='npx avero run "fix the flaky retry test"'
              caption="Not on npm yet. From a checkout of this repository, run pnpm avero run instead."
            />
          </div>
        </div>
        <ReplayScope
          record={exampleRecord}
          label={`Real recorded run · ${exampleRecord.started.model}`}
        />
      </section>

      <RecorderStory lines={recordLinesFrom(exampleRecord)} />

      <section id="verdict" data-mk="section" aria-labelledby="verdict-title">
        <Reveal data-head="">
          <p data-mk="kicker">02 · Verdict</p>
          <h2 id="verdict-title">Review the evidence, not just the diff.</h2>
          <p data-mk="lede">
            Reviewing agent work means rebuilding the task from the code. An independent reviewer
            agent does that first, and Avero then checks the reviewer against the record: it drops
            claims about files that were not changed and raises the risk when the record says so.
            You still decide.
          </p>
        </Reveal>
        <VerdictDemo />
      </section>

      <section id="bench" data-mk="section" aria-labelledby="bench-title">
        <Reveal data-head="">
          <p data-mk="kicker">03 · Bench</p>
          <h2 id="bench-title">Find the best setup for your repository, per dollar.</h2>
          <p data-mk="lede">
            Commits in your history that changed code and tests together become tasks. The agent
            never sees the tests; they are put back afterwards and decide. Avero runs every task
            under each model and rules file and reports what a resolved task cost, failed attempts
            included.
          </p>
        </Reveal>
        <BenchDemo />
      </section>

      <section data-mk="section" aria-labelledby="share-title">
        <Reveal data-head="">
          <p data-mk="kicker">04 · Share</p>
          <h2 id="share-title">Send a replay, not a screenshot.</h2>
          <p data-mk="lede">
            Records are plain files on your machine. Turn one into a file a teammate can open, a
            trace another tool can read, or a tool your own agent can call.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <ul data-mk="ship" aria-label="What Avero can export">
            {shipped.map((item) => (
              <li key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <code>{item.command}</code>
              </li>
            ))}
          </ul>
        </Reveal>
        <p data-mk="aside">
          Planned, not built: GitHub, Slack, webhooks, schedules and OpenTelemetry export.
        </p>
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
          Shipped: <code>avero mcp</code> lets an agent list runs, read a verdict and search your
          recordings. Planned: starting a run and asking for your approval through the same tools.
        </p>
      </section>

      <section id="start" data-mk="section" aria-labelledby="start-title">
        <Reveal data-head="">
          <p data-mk="kicker">Try it</p>
          <h2 id="start-title">Three commands, on your own machine.</h2>
          <p data-mk="lede">
            You need Node.js 24 or newer and a Cursor API key. Avero is not on npm yet, so run it
            from a checkout of this repository with <code>pnpm avero</code> in place of{' '}
            <code>avero</code>. Try it on a throwaway copy: the agent really edits files.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <ol data-mk="start">
            {start.map((item) => (
              <li key={item.step}>
                <strong>{item.step}</strong>
                <code>$ {item.command}</code>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      <section id="roadmap" data-mk="section" aria-labelledby="roadmap-title">
        <Reveal data-head="">
          <p data-mk="kicker">Roadmap</p>
          <h2 id="roadmap-title">Where this is going, in order.</h2>
          <p data-mk="lede">
            Local-first first: one command and one API key. Phases 0 to 4 are built and have been
            run on real agents; a hosted team workspace comes after, over the same record format.
          </p>
        </Reveal>
        <Roadmap />
      </section>

      <section data-mk="closing" aria-labelledby="closing-title">
        <div data-mk="closing-copy">
          <p data-mk="kicker">The console</p>
          <h2 id="closing-title">Record a run, then replay it.</h2>
          <p data-mk="lede">
            Record a run with the command line, then open it here: the replay, the diff and the
            reviewer&apos;s verdict side by side, your decision, and the bench results, all read
            from files on your machine. Nothing in the console is simulated.
          </p>
          <Link data-kit="button" data-tone="primary" href="/overview">
            Open the console
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
