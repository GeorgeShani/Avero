import type { PageData, ViewFile } from './view.ts';

/**
 * The replay that runs inside a shared page. It is written as a typed function so the compiler and
 * the linter check it, then printed into the page with `Function.prototype.toString`. Because of
 * that it must stay self-contained: no imports at run time, no reference to anything outside the
 * function, and no template literals that could be mistaken for markup.
 *
 * Every piece of text from the run goes through `textContent` or a text node. Nothing here builds
 * markup from data, so a hostile record cannot add elements or run script.
 */
export function replayClient(): void {
  const raw = document.getElementById('avero-data');
  const data = JSON.parse(raw?.textContent || '{}') as PageData;

  function byId(id: string): HTMLElement {
    const found = document.getElementById(id);
    if (!found) throw new Error('The page is missing #' + id);
    return found;
  }

  type Child = Node | string | null | undefined | false;

  function el(tag: string, cls?: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function put(parent: HTMLElement, ...children: Child[]): HTMLElement {
    for (const child of children) {
      if (child === null || child === undefined || child === false) continue;
      parent.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return parent;
  }

  const pad = (value: number, size: number) => String(value).padStart(size, '0');

  function clock(ms: number): string {
    const whole = Math.max(0, ms) / 1000;
    const minutes = Math.floor(whole / 60);
    const seconds = Math.floor(whole % 60);
    const tenths = Math.floor((whole * 10) % 10);
    return pad(minutes, 2) + ':' + pad(seconds, 2) + '.' + tenths;
  }

  function took(ms: number): string {
    return ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s';
  }

  function money(cents: number | null): string {
    if (cents === null) return 'not reported';
    return '$' + (cents / 100).toFixed(cents < 100 ? 3 : 2);
  }

  function when(iso: string): string {
    return iso.slice(0, 10) + ' ' + iso.slice(11, 16) + ' UTC';
  }

  const length = Math.max(1, data.length || 1);

  // ---- Header and facts -------------------------------------------------------------------
  byId('title').textContent = data.task;
  byId('meta').textContent =
    data.runId +
    ' · ' +
    data.model +
    ' · recorded ' +
    when(data.startedAt) +
    ' · folder “' +
    data.workspace +
    '”';
  const status = byId('status');
  status.textContent = data.status.toLowerCase();
  status.setAttribute('data-status', data.status);

  const changes = data.changes;
  const facts: [string, string][] = [
    ['Duration', took(data.durationMs)],
    ['Tokens', data.totalTokens.toLocaleString('en-US')],
    ['Billed cost', money(data.costCents)],
    [
      'Changes',
      changes
        ? changes.files.length + ' files +' + changes.additions + ' −' + changes.deletions
        : 'none recorded',
    ],
  ];
  const factsList = byId('facts');
  for (const [label, value] of facts) {
    put(factsList, put(el('div'), el('dt', undefined, label), el('dd', undefined, value)));
  }

  // ---- Timeline ---------------------------------------------------------------------------
  type BarState = { el: HTMLElement; start: number; end: number; counted: boolean; state: string };
  const bars: BarState[] = [];
  const timeline = byId('wf');
  const summary: string[] = [];
  for (const lane of data.lanes) {
    const track = el('span', 'track');
    for (const bar of lane.bars) {
      const mark = el('i');
      mark.setAttribute('title', bar.label);
      mark.setAttribute('data-state', 'later');
      if (bar.failed) mark.setAttribute('data-failed', '');
      mark.style.left = (bar.start / length) * 100 + '%';
      mark.style.width = Math.max(((bar.end - bar.start) / length) * 100, 0.5) + '%';
      track.append(mark);
      bars.push({
        el: mark,
        start: bar.start,
        end: bar.end,
        counted: lane.kind !== 'thinking',
        state: 'later',
      });
    }
    const row = el('div', 'lane');
    row.setAttribute('data-kind', lane.kind);
    put(row, el('span', 'lane-label', lane.label), track);
    timeline.append(row);
    summary.push(lane.bars.length + ' ' + lane.label);
  }
  timeline.setAttribute(
    'aria-label',
    'Timeline of the run: ' + (summary.join(', ') || 'no activity'),
  );
  timeline.append(el('span', 'playhead'));

  // ---- Feed -------------------------------------------------------------------------------
  const feed = byId('feed');
  const idle = el('li', 'idle', 'Press play, or drag the playhead.');
  feed.append(idle);
  const rows = data.feed.map((row) => {
    const item = el('li');
    item.setAttribute('data-kind', row.kind);
    if (row.failed) item.setAttribute('data-failed', '');
    item.hidden = true;
    const button = el('button', 'row');
    button.setAttribute('type', 'button');
    button.setAttribute('title', 'Jump to this moment');
    put(
      button,
      el('span', 'when', clock(row.t)),
      el('span', 'what', row.title),
      row.took !== undefined && el('span', 'took', took(row.took)),
      row.detail && el('span', 'detail', row.detail),
    );
    button.addEventListener('click', () => seek(row.t));
    item.append(button);
    feed.append(item);
    return { el: item, t: row.t };
  });
  let shown = 0;

  // ---- Controls ---------------------------------------------------------------------------
  const clockOut = byId('r-time');
  const tokenOut = byId('r-tokens');
  const callOut = byId('r-calls');
  const play = byId('play');
  const range = byId('playhead') as HTMLInputElement;
  range.min = '0';
  range.max = String(length);
  range.step = String(Math.max(1, Math.round(length / 1000)));

  function tokensAt(ms: number): number {
    if (ms >= length) return data.totalTokens;
    let total = 0;
    for (const point of data.tokens) {
      if (point[0] > ms) break;
      total = point[1];
    }
    return total;
  }

  let time = 0;
  let playing = false;
  let speed = length <= 10_000 ? 1 : length <= 120_000 ? 4 : 16;
  let last = 0;
  let frame = 0;

  const speedBox = byId('speed');
  const speedButtons = [1, 4, 16].map((value) => {
    const button = el('button', 'speed', value + 'x');
    button.setAttribute('type', 'button');
    button.addEventListener('click', () => {
      speed = value;
      markSpeed();
    });
    speedBox.append(button);
    return { button, value };
  });
  function markSpeed() {
    for (const item of speedButtons) {
      item.button.setAttribute('aria-pressed', item.value === speed ? 'true' : 'false');
    }
  }
  markSpeed();

  function render() {
    timeline.style.setProperty('--t', String(time / length));
    clockOut.textContent = clock(time);
    tokenOut.textContent = pad(tokensAt(time), 6);
    let calls = 0;
    for (const bar of bars) {
      const state = bar.end <= time ? 'done' : bar.start <= time ? 'live' : 'later';
      if (bar.state !== state) {
        bar.state = state;
        bar.el.setAttribute('data-state', state);
      }
      if (bar.counted && bar.start <= time) calls += 1;
    }
    callOut.textContent = pad(calls, 3);

    const before = shown;
    while (shown < rows.length && (rows[shown]?.t ?? Infinity) <= time) {
      const row = rows[shown];
      if (row) row.el.hidden = false;
      shown += 1;
    }
    while (shown > 0 && (rows[shown - 1]?.t ?? 0) > time) {
      shown -= 1;
      const row = rows[shown];
      if (row) row.el.hidden = true;
    }
    idle.hidden = shown > 0;
    if (shown > before) feed.scrollTop = feed.scrollHeight;

    range.value = String(Math.round(time));
    range.setAttribute('aria-valuetext', clock(time));
  }

  function setPlaying(next: boolean) {
    playing = next;
    play.textContent = playing ? 'Pause' : 'Play';
    play.setAttribute('aria-label', playing ? 'Pause replay' : 'Play replay');
    cancelAnimationFrame(frame);
    if (playing) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    // A tab that was hidden can report a long gap. Cap it so the replay does not jump.
    const gap = Math.min(now - last, 250);
    last = now;
    time = Math.min(length, time + gap * speed);
    render();
    if (time >= length) setPlaying(false);
    else frame = requestAnimationFrame(tick);
  }

  function seek(ms: number) {
    time = Math.min(length, Math.max(0, ms));
    setPlaying(false);
    render();
  }

  play.addEventListener('click', () => {
    if (!playing && time >= length) time = 0;
    setPlaying(!playing);
    render();
  });
  range.addEventListener('input', () => seek(Number(range.value)));

  // ---- Verdict and decision ---------------------------------------------------------------
  function card(title: string, ...body: Child[]): HTMLElement {
    return put(el('section', 'card'), el('h2', undefined, title), ...body);
  }

  const marks: Record<string, string> = { pass: '✓', fail: '✕', unclear: '?' };
  const words: Record<string, string> = { pass: 'Pass', fail: 'Fails', unclear: 'Unclear' };
  const tierMarks: Record<string, string> = { low: '●', medium: '▲', high: '◆' };
  const decisionWords: Record<string, string> = {
    approved: 'Approved',
    'changes-requested': 'Changes requested',
    rejected: 'Rejected',
  };

  function list(items: Child[][], label?: string): HTMLElement {
    const ul = el('ul');
    if (label) ul.setAttribute('aria-label', label);
    for (const parts of items) put(ul, put(el('li'), ...parts));
    return ul;
  }

  const verdictBox = byId('verdict');
  const verdict = data.verdict;
  const decision = data.decision;
  if (verdict) {
    const counts = { pass: 0, fail: 0, unclear: 0 } as Record<string, number>;
    for (const check of verdict.checks) counts[check.verdict] = (counts[check.verdict] ?? 0) + 1;

    const tier = el('span', 'tier');
    tier.setAttribute('data-tier', verdict.risk.tier);
    put(
      tier,
      el('span', undefined, tierMarks[verdict.risk.tier] ?? ''),
      ' ' + verdict.risk.tier + ' risk',
    );

    const checks = el('ul', 'checks');
    checks.setAttribute('aria-label', 'Checks against the task');
    for (const check of verdict.checks) {
      const item = el('li');
      item.setAttribute('data-verdict', check.verdict);
      const mark = el('span', 'mark', marks[check.verdict] ?? '?');
      mark.setAttribute('aria-hidden', 'true');
      const files = check.files && check.files.length > 0 ? el('span', 'files') : null;
      if (files && check.files)
        for (const file of check.files) files.append(el('code', undefined, file));
      put(
        item,
        mark,
        put(
          el('span'),
          el('strong', undefined, check.claim),
          el('em', undefined, (words[check.verdict] ?? '') + ': ' + check.evidence),
          files,
        ),
      );
      checks.append(item);
    }

    const tests = verdict.tests;
    const facts3 = put(
      el('div', 'vfacts'),
      put(
        el('section'),
        el('h3', undefined, 'Tests'),
        el(
          'p',
          undefined,
          (tests.ran ? (tests.passed ? 'Ran and passed. ' : 'Ran. ') : 'Not run. ') +
            tests.evidence,
        ),
      ),
      put(
        el('section'),
        el('h3', undefined, 'Outside the task'),
        verdict.outOfScope.length === 0
          ? el('p', undefined, 'Nothing outside what the task asked for.')
          : list(
              verdict.outOfScope.map((entry) => [
                el('code', undefined, entry.path),
                ' ' + entry.reason,
              ]),
            ),
      ),
      put(
        el('section'),
        el('h3', undefined, 'Why this risk'),
        verdict.risk.reasons.length === 0
          ? el('p', undefined, 'No reasons given.')
          : list(verdict.risk.reasons.map((reason) => [reason])),
      ),
    );

    const body = put(
      el('div', 'verdict'),
      put(
        el('div', 'vhead'),
        tier,
        el(
          'span',
          'dim',
          counts.pass + ' pass · ' + counts.fail + ' fail · ' + counts.unclear + ' unclear',
        ),
        el('span', 'dim', 'reviewed ' + when(verdict.reviewer.reviewedAt)),
      ),
      el('p', 'vsummary', verdict.summary),
      checks,
      facts3,
      verdict.adjustments.length > 0 &&
        put(
          el('details'),
          el(
            'summary',
            undefined,
            'Avero corrected the reviewer on ' + verdict.adjustments.length + ' point(s)',
          ),
          list(verdict.adjustments.map((line) => [line])),
        ),
    );
    verdictBox.append(
      put(
        el('section', 'card'),
        el('h2', undefined, 'Verdict'),
        el(
          'p',
          'dim',
          'Written by ' +
            verdict.reviewer.model +
            ', an AI reviewer. Avero checked it against the record. A person decides.',
        ),
        body,
      ),
    );
  }
  if (decision) {
    const line = put(
      el('p', 'decided'),
      el('strong', undefined, decisionWords[decision.decision] ?? decision.decision),
      ' · ' + when(decision.decidedAt) + (decision.note ? ' · “' + decision.note + '”' : ''),
    );
    line.setAttribute('data-decision', decision.decision);
    verdictBox.append(card('Decision', line));
  }

  // ---- Task and result --------------------------------------------------------------------
  const columns = byId('columns');
  columns.append(card('Task', el('p', 'prose', data.task)));
  const result = card('Result');
  if (data.error)
    put(
      result,
      put(el('p', 'alert'), el('strong', undefined, 'The run ended with an error. '), data.error),
    );
  put(
    result,
    el('p', 'prose', data.result ?? (data.error ? '' : 'No final message was recorded.')),
  );
  columns.append(result);

  // ---- Changes ----------------------------------------------------------------------------
  const changesBox = byId('changes');
  if (!changes) {
    changesBox.append(
      card(
        'Changes',
        el(
          'p',
          'dim',
          data.status === 'RUNNING'
            ? 'The run did not finish, so no changes were recorded.'
            : 'The folder was not a git repository, so changes were not recorded.',
        ),
      ),
    );
  } else if (changes.files.length === 0) {
    changesBox.append(card('Changes', el('p', 'prose', 'The agent changed no files.')));
  } else {
    const patchBox = el('div', 'patch');
    patchBox.setAttribute('role', 'region');
    patchBox.setAttribute('tabindex', '0');
    const fileButtons: { button: HTMLElement; path: string }[] = [];

    const showFile = (file: ViewFile) => {
      for (const item of fileButtons) {
        if (item.path === file.path) item.button.setAttribute('aria-current', 'true');
        else item.button.removeAttribute('aria-current');
      }
      patchBox.setAttribute('aria-label', 'Changes to ' + file.path);
      patchBox.replaceChildren();
      const patch = data.patches.find((entry) => entry.path === file.path);
      if (!patch) {
        const note = el(
          'div',
          undefined,
          file.status === 'untracked'
            ? 'A new file git did not track yet, so it has no patch. It was counted by its lines.'
            : 'No patch was recorded for this file.',
        );
        note.setAttribute('data-k', 'meta');
        patchBox.append(note);
        return;
      }
      let inHunk = false;
      for (const text of patch.text.split('\n')) {
        let kind = 'ctx';
        if (text.startsWith('@@')) {
          inHunk = true;
          kind = 'hunk';
        } else if (!inHunk) kind = 'meta';
        else if (text.startsWith('+')) kind = 'add';
        else if (text.startsWith('-')) kind = 'del';
        const line = el('div', undefined, text === '' ? ' ' : text);
        line.setAttribute('data-k', kind);
        patchBox.append(line);
      }
    };

    const filesList = el('ul', 'files-list');
    filesList.setAttribute('aria-label', 'Changed files');
    for (const file of changes.files) {
      const button = el('button', 'file');
      button.setAttribute('type', 'button');
      put(
        button,
        el('span', 'status', file.status),
        el('span', 'path', file.path),
        el('span', 'num', file.additions === null ? '–' : '+' + file.additions),
        el('span', 'num', file.deletions === null ? '–' : '−' + file.deletions),
      );
      button.addEventListener('click', () => showFile(file));
      fileButtons.push({ button, path: file.path });
      put(filesList, put(el('li'), button));
    }
    const first = changes.files[0];
    if (first) showFile(first);
    changesBox.append(
      card(
        'Changes',
        el(
          'p',
          'dim',
          changes.files.length +
            ' files changed in “' +
            data.workspace +
            '”, counted from git when the run ended.',
        ),
        filesList,
        changes.patchTruncated &&
          el(
            'p',
            'alert',
            'The patch was cut at 200,000 characters. Later files may be missing below. The file list is complete.',
          ),
        patchBox,
      ),
    );
  }

  // ---- Start ------------------------------------------------------------------------------
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    // With reduced motion the replay starts at the end, so everything is on screen.
    time = length;
    render();
    setPlaying(false);
  } else {
    render();
    setPlaying(true);
  }
}
