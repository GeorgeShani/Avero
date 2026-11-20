import { runInNewContext, Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { pageCsp, renderRunPage } from './page.ts';
import {
  FakeDom,
  sampleDecision,
  sampleRecord,
  sampleVerdict,
  samplePatch,
} from './test-fixtures.ts';
import type { PageData } from './view.ts';

const dataPattern = /<script type="application\/json" id="avero-data">([\s\S]*?)<\/script>/;

function dataOf(html: string): PageData {
  const match = dataPattern.exec(html);
  if (!match?.[1]) throw new Error('no data block');
  return JSON.parse(match[1]) as PageData;
}

function scriptOf(html: string): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match?.[1]) throw new Error('no script block');
  return match[1];
}

/** Runs the page's script against a fake document, and returns the document to look at. */
function runPage(html: string, options: { reduced?: boolean } = {}): FakeDom {
  const dom = new FakeDom(JSON.stringify(dataOf(html)));
  dom.reduced = options.reduced ?? false;
  runInNewContext(scriptOf(html), dom.globals());
  return dom;
}

describe('renderRunPage', () => {
  const html = renderRunPage(sampleRecord(), {
    verdict: sampleVerdict(),
    decision: sampleDecision(),
  });

  it('is one document with a strict content security policy and no network references', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${pageCsp}" />`);
    expect(pageCsp).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
    );
    const withoutData = html.replace(dataPattern, '');
    expect(withoutData).not.toMatch(/\b(?:src|href|action)\s*=/);
    expect(withoutData).not.toMatch(/https?:\/\//);
    expect(withoutData).not.toMatch(/@import|url\(|<link|<img|<iframe|<form/);
    expect(withoutData).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|import\(/);
  });

  it('embeds the run as JSON that reads back to the same data', () => {
    const data = dataOf(html);
    expect(data.runId).toBe('run-sample');
    expect(data.task).toBe('Retry failed webhook deliveries with exponential backoff.');
    expect(data.length).toBe(7000);
    expect(data.totalTokens).toBe(1000);
    expect(data.costCents).toBeNull();
    expect(data.lanes.map((lane) => lane.kind)).toEqual(['thinking', 'read', 'edit', 'shell']);
    expect(data.patches.map((patch) => patch.path)).toEqual(['src/retry.ts', 'src/new.ts']);
    expect(data.verdict?.risk.tier).toBe('low');
    expect(data.decision?.decision).toBe('approved');
  });

  it('keeps the script short and free of ways to build markup or reach the network', () => {
    const script = scriptOf(html);
    for (const banned of [
      'innerHTML',
      'outerHTML',
      'insertAdjacentHTML',
      'document.write',
      'eval(',
      'new Function',
      'setTimeout(',
      'srcdoc',
      '</script',
      '<!--',
      '__name',
      '__vite',
    ]) {
      expect(script).not.toContain(banned);
    }
    expect(() => new Script(script)).not.toThrow();
    // The page without the run's own data stays small.
    expect(html.length - (dataPattern.exec(html)?.[0].length ?? 0)).toBeLessThan(60_000);
  });

  it('shows the facts, the lanes, the feed, the verdict, the decision and the diff', () => {
    const dom = runPage(html);
    expect(dom.node('title').textContent).toBe(
      'Retry failed webhook deliveries with exponential backoff.',
    );
    expect(dom.node('facts').textContent).toContain('1,000');
    expect(dom.node('facts').textContent).toContain('not reported');
    expect(dom.node('facts').textContent).toContain('2 files +6 −1');
    expect(dom.node('wf').getAttribute('aria-label')).toContain('1 read');
    expect(dom.node('feed').textContent).toContain('shell npm test');
    expect(dom.node('verdict').textContent).toContain('low risk');
    expect(dom.node('verdict').textContent).toContain('Retry with exponential backoff');
    expect(dom.node('verdict').textContent).toContain('Approved');
    expect(dom.node('changes').textContent).toContain('src/new.ts');
    expect(dom.node('changes').textContent).toContain('+const MAX = 4;');
    // A tool failure and a patch line are classified for colouring.
    const kinds = new Set<string>();
    for (const node of dom.everything()) {
      const kind = node.getAttribute('data-k');
      if (kind) kinds.add(kind);
    }
    expect([...kinds].sort()).toEqual(['add', 'ctx', 'del', 'hunk', 'meta']);
  });

  it('plays, and can be paused, sought and restarted', () => {
    const dom = runPage(html);
    const play = dom.node('play');
    expect(play.textContent).toBe('Pause');
    dom.run();
    expect(dom.node('r-time').textContent).toBe('00:07.0');
    expect(dom.node('r-tokens').textContent).toBe('001000');
    expect(dom.node('r-calls').textContent).toBe('003');
    expect(play.textContent).toBe('Play');

    // Seek with the playhead: the feed rewinds to what had happened by then.
    const range = dom.node('playhead');
    range.value = '1650';
    range.fire('input');
    expect(dom.node('r-time').textContent).toBe('00:01.6');
    expect(dom.node('feed').visibleText).toContain('Reading the code first.');
    expect(dom.node('feed').visibleText).not.toContain('npm test');
    expect(dom.node('r-calls').textContent).toBe('000');
    expect(play.textContent).toBe('Play');

    // Play again from the middle continues to the end, and from the end it restarts.
    play.fire('click');
    expect(play.textContent).toBe('Pause');
    dom.run();
    expect(dom.node('r-time').textContent).toBe('00:07.0');
    play.fire('click');
    expect(dom.node('r-time').textContent).toBe('00:00.0');
    expect(play.textContent).toBe('Pause');
  });

  it('seeks when a feed row is clicked', () => {
    const dom = runPage(html, { reduced: true });
    const rows = dom
      .everything()
      .filter((node) => node.className === 'row' && node.textContent.includes('read src/retry.ts'));
    expect(rows).toHaveLength(1);
    rows[0]?.fire('click');
    expect(dom.node('r-time').textContent).toBe('00:01.7');
    expect(dom.node('feed').visibleText).not.toContain('npm test');
  });

  it('starts at the end and does not animate when the reader prefers reduced motion', () => {
    const dom = runPage(html, { reduced: true });
    expect(dom.frames).toHaveLength(0);
    expect(dom.node('r-time').textContent).toBe('00:07.0');
    expect(dom.node('play').textContent).toBe('Play');
    expect(dom.node('feed').visibleText).toContain('npm test');
  });

  it('offers the speeds and starts at one that fits the length of the run', () => {
    const dom = runPage(html);
    const buttons = dom.everything().filter((node) => node.className === 'speed');
    expect(buttons.map((node) => node.textContent)).toEqual(['1x', '4x', '16x']);
    // A 7 second run plays at 1x.
    expect(buttons.map((node) => node.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    buttons[2]?.fire('click');
    expect(buttons.map((node) => node.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
  });

  it('shows a failed run with its error', () => {
    const record = sampleRecord();
    const events = record.events.map((event) =>
      event.type === 'run.finished'
        ? { ...event, status: 'ERROR' as const, error: 'The model stopped responding.' }
        : event,
    );
    const finished = events.find((event) => event.type === 'run.finished');
    const failed = renderRunPage({
      started: record.started,
      events,
      ...(finished?.type === 'run.finished' ? { finished } : {}),
    });
    const dom = runPage(failed);
    expect(dom.node('status').textContent).toBe('error');
    expect(dom.node('status').getAttribute('data-status')).toBe('ERROR');
    expect(dom.node('columns').textContent).toContain('The model stopped responding.');
  });

  it('shows a run with no changes, and a run that is not in a git repository', () => {
    const record = sampleRecord({ files: [], patch: '' });
    const none = runPage(renderRunPage(record));
    expect(none.node('changes').textContent).toContain('changed no files');

    const bare = sampleRecord();
    const unfinished = renderRunPage({
      started: bare.started,
      events: bare.events.filter((event) => event.type !== 'run.finished'),
    });
    const running = runPage(unfinished);
    expect(running.node('status').getAttribute('data-status')).toBe('RUNNING');
    expect(running.node('changes').textContent).toContain('did not finish');

    const events = bare.events.map((event) => {
      if (event.type !== 'run.finished') return event;
      const rest = { ...event };
      delete rest.changes;
      return rest;
    });
    const finished = events.find((event) => event.type === 'run.finished');
    const noGit = runPage(
      renderRunPage({
        started: bare.started,
        events,
        ...(finished?.type === 'run.finished' ? { finished } : {}),
      }),
    );
    expect(noGit.node('changes').textContent).toContain('not a git repository');
  });

  it('adds a link back to the list only for a simple path', () => {
    expect(renderRunPage(sampleRecord(), { backHref: '/' })).toContain('<a class="back" href="/">');
    expect(renderRunPage(sampleRecord(), { backHref: 'javascript:alert(1)' })).not.toContain(
      'class="back"',
    );
    expect(renderRunPage(sampleRecord(), { backHref: '/"><script>' })).not.toContain(
      'class="back"',
    );
    expect(renderRunPage(sampleRecord())).not.toContain('class="back"');
  });

  it('puts the task in the title, escaped', () => {
    const page = renderRunPage(sampleRecord({ task: 'Fix <b>this</b> & "that"' }));
    expect(page).toContain(
      '<title>Fix &lt;b&gt;this&lt;/b&gt; &amp; &quot;that&quot; · Avero run</title>',
    );
    expect(renderRunPage(sampleRecord(), { title: '</title><script>x</script>' })).toContain(
      '<title>&lt;/title&gt;&lt;script&gt;x&lt;/script&gt; · Avero run</title>',
    );
  });
});

describe('a hostile record', () => {
  const attack = '</script><img src=x onerror="window.pwned=1">';
  const hostileRecord = sampleRecord({
    task: `Do it ${attack}`,
    result: `Result ${attack}`,
    toolArgs: { path: attack },
    patch: [
      `diff --git a/${attack} b/${attack}`,
      `--- a/${attack}`,
      `+++ b/${attack}`,
      '@@ -1 +1 @@',
      `-old ${attack}`,
      `+new ${attack}`,
      '',
    ].join('\n'),
    files: [{ path: attack, status: 'modified', additions: 1, deletions: 1 }],
  });
  const hostileVerdict = sampleVerdict({
    summary: `Summary ${attack}`,
    checks: [
      {
        id: 'a',
        claim: `Claim ${attack}`,
        verdict: 'pass',
        evidence: `Evidence ${attack}`,
        files: [attack],
      },
    ],
    outOfScope: [{ path: attack, reason: `Reason ${attack}` }],
    tests: { ran: true, evidence: `Tests ${attack}` },
    risk: { tier: 'low', reasons: [`Why ${attack}`] },
    adjustments: [`Adjusted ${attack}`],
  });
  const html = renderRunPage(hostileRecord, {
    verdict: hostileVerdict,
    decision: sampleDecision({ note: `Note ${attack}` }),
  });

  it('cannot close the data tag or add markup to the document', () => {
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror="window');
    // The text is all still there, as data.
    const data = dataOf(html);
    expect(data.task).toBe(`Do it ${attack}`);
    expect(data.verdict?.summary).toBe(`Summary ${attack}`);
    expect(data.patches[0]?.text).toContain(`+new ${attack}`);
  });

  it('is drawn as text: no element, attribute or markup comes from the data', () => {
    const dom = runPage(html);
    const tags = new Set(dom.created.map((node) => node.tag));
    for (const tag of ['img', 'script', 'iframe', 'a', 'svg', 'object', 'style']) {
      expect(tags.has(tag)).toBe(false);
    }
    for (const node of dom.everything()) {
      for (const name of node.attributes.keys()) expect(name.startsWith('on')).toBe(false);
    }
    // Each hostile string was set as text on some node, in every place the page shows it.
    const text = dom
      .everything()
      .map((node) => node.textContent)
      .join('\n');
    expect(text).toContain(`Do it ${attack}`);
    expect(dom.node('columns').textContent).toContain(`Result ${attack}`);
    expect(dom.node('verdict').textContent).toContain(`Summary ${attack}`);
    expect(dom.node('verdict').textContent).toContain(`Evidence ${attack}`);
    expect(dom.node('verdict').textContent).toContain(`Note ${attack}`);
    expect(dom.node('feed').textContent).toContain(`read ${attack}`.slice(0, 60));
    expect(dom.node('changes').textContent).toContain(`+new ${attack}`);
  });
});

describe('a larger run', () => {
  it('stays small and quick to draw with a thousand tool calls', () => {
    const record = sampleRecord({ patch: samplePatch });
    const extra = Array.from({ length: 1000 }, (_unused, index) => ({
      type: 'tool' as const,
      seq: 100 + index,
      t: 100 + index * 5,
      callId: `x${index}`,
      name: 'read',
      status: 'completed' as const,
      args: { path: `file-${index}.ts` },
    }));
    const events = [...extra, ...record.events].sort((a, b) => a.t - b.t);
    const finished = events.find((event) => event.type === 'run.finished');
    const html = renderRunPage({
      started: record.started,
      events,
      ...(finished?.type === 'run.finished' ? { finished } : {}),
    });
    const started = performance.now();
    const dom = runPage(html, { reduced: true });
    expect(performance.now() - started).toBeLessThan(2000);
    expect(dom.node('r-calls').textContent).toBe('1003');
  });
});
