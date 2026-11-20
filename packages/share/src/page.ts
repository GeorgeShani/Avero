import type { Decision, RunRecord, Verdict } from '@avero/contracts';
import { replayClient } from './client.ts';
import { baseCss, runCss } from './styles.ts';
import { buildPageData } from './view.ts';

/**
 * What a shared page may do. It can run its own inline script and style, and show data: images.
 * It cannot ask the network for anything, so a page opened from an email or a file server cannot
 * send what it shows anywhere.
 */
export const pageCsp =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

/** For pages with no script at all. */
export const staticPageCsp =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JSON that is safe inside `<script type="application/json">`. A `<` becomes `<`, so no text
 * in the data can close the tag or open a comment, and the line separators that older parsers
 * treat as line breaks are escaped too. `JSON.parse` reads the escapes back as the same text.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

export type RunPageOptions = {
  verdict?: Verdict | undefined;
  decision?: Decision | undefined;
  /** The page title. Defaults to the task. */
  title?: string;
  /** Shows a link back to the list. Only simple paths are accepted, for example `/`. */
  backHref?: string;
};

const clientSource = `(${replayClient.toString()})();`;

const skeleton = `<main class="page">
<noscript><p class="alert">This replay needs JavaScript. The run itself is in the page source as JSON.</p></noscript>
<div id="back-slot"></div>
<header class="head">
  <div><h1 id="title"></h1><p class="meta" id="meta"></p></div>
  <span class="badge" id="status"></span>
</header>
<dl class="facts" id="facts"></dl>
<section class="scope" aria-label="Replay of the run">
  <div class="screen">
    <div class="wf" id="wf" role="img"></div>
    <ol class="feed" id="feed" aria-label="What the agent did so far"></ol>
  </div>
  <div class="controls">
    <div class="readouts">
      <div class="lcd"><span class="tag">Time</span><span class="val" id="r-time">00:00.0</span></div>
      <div class="lcd"><span class="tag">Tokens</span><span class="val" id="r-tokens">000000</span></div>
      <div class="lcd"><span class="tag">Calls</span><span class="val" id="r-calls">000</span></div>
    </div>
    <div class="transport">
      <button type="button" class="btn" id="play" aria-label="Play replay">Play</button>
      <input type="range" id="playhead" aria-label="Playhead" value="0" />
      <div class="speed-box" id="speed" role="group" aria-label="Speed"></div>
    </div>
  </div>
</section>
<div id="verdict" class="verdict-slot"></div>
<div class="columns" id="columns"></div>
<div id="changes"></div>
<p class="foot">Recorded with Avero. This page is one file with no network requests. Secrets were scrubbed with a pattern-based pass before export, which can miss things, so read what you share.</p>
</main>`;

function safeBackHref(href: string | undefined): string | undefined {
  return href !== undefined && /^[A-Za-z0-9_./-]{1,200}$/.test(href) ? href : undefined;
}

/**
 * One self-contained HTML document that replays a run: all style and script inline, the run
 * embedded as JSON, no network request. The page builds its text with `textContent`, so nothing
 * in the record can add markup or run script.
 */
export function renderRunPage(record: RunRecord, options: RunPageOptions = {}): string {
  const data = buildPageData(record, { verdict: options.verdict, decision: options.decision });
  const title = options.title ?? record.started.task;
  const back = safeBackHref(options.backHref);
  const body = back
    ? skeleton.replace(
        '<div id="back-slot"></div>',
        `<a class="back" href="${escapeHtml(back)}">← All runs</a>`,
      )
    : skeleton.replace('<div id="back-slot"></div>\n', '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${pageCsp}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="referrer" content="no-referrer" />
<title>${escapeHtml(`${title.replace(/\s+/g, ' ').slice(0, 120)} · Avero run`)}</title>
<style>${baseCss}${runCss}</style>
</head>
<body>
${body}
<script type="application/json" id="avero-data">${jsonForScript(data)}</script>
<script>${clientSource}</script>
</body>
</html>
`;
}
