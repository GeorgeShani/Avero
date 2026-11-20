/**
 * Styles for the shared pages. Hardware-instrument look: bone panels, a dark display, one mineral
 * green key colour, mono type for data. Light by default, dark through `prefers-color-scheme`.
 * No web fonts and no images: nothing here asks the network for anything.
 */

export const baseCss = `
:root {
  color-scheme: light dark;
  --bg: #e4e4df;
  --panel: #f3f3ef;
  --panel-2: #eaeae5;
  --ink: #1b1b19;
  --dim: #6a6a64;
  --hair: #c6c6bf;
  --key: oklch(0.5 0.1 163);
  --key-soft: oklch(0.5 0.1 163 / 0.14);
  --glow: oklch(0.84 0.15 163);
  --screen: #161614;
  --screen-ink: #ecece6;
  --screen-dim: #8e8e87;
  --warn: #8a5a10;
  --bad: #a32e22;
  --bad-soft: rgb(192 57 43 / 0.1);
  --mono: ui-monospace, 'SFMono-Regular', 'Cascadia Mono', Menlo, Consolas, monospace;
  --sans: 'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f0e;
    --panel: #1a1a18;
    --panel-2: #232321;
    --ink: #ecece6;
    --dim: #a0a099;
    --hair: #34342f;
    --key: oklch(0.78 0.13 163);
    --key-soft: oklch(0.78 0.13 163 / 0.16);
    --screen: #0b0b0a;
    --warn: #e0b25a;
    --bad: #ff8a7a;
    --bad-soft: rgb(255 138 122 / 0.12);
  }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 13px/1.5 var(--mono);
}
.page { max-width: 1080px; margin: 0 auto; padding: 24px 16px 56px; display: grid; gap: 18px; }
a { color: var(--key); }
:focus-visible { outline: 2px solid var(--key); outline-offset: 2px; }
button { font: inherit; color: inherit; }
h1, h2, h3 { font-family: var(--sans); font-weight: 600; letter-spacing: -0.02em; margin: 0; }
h1 { font-size: clamp(24px, 3.4vw, 36px); line-height: 1.15; overflow-wrap: anywhere; }
h2 { font-size: 17px; }
.meta, .dim { color: var(--dim); font-size: 12px; margin: 4px 0 0; overflow-wrap: anywhere; }
.card {
  display: grid; gap: 12px; align-content: start;
  padding: 16px 18px; border-radius: 14px;
  background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair);
}
.card > * { margin: 0; }
.prose { line-height: 1.65; overflow-wrap: anywhere; white-space: pre-wrap; font-family: var(--sans); font-size: 14px; }
.alert {
  padding: 10px 12px; border-radius: 8px; background: var(--bad-soft);
  box-shadow: inset 0 0 0 1px var(--bad); color: var(--ink); overflow-wrap: anywhere;
}
code { font-family: var(--mono); }
.foot { color: var(--dim); font-size: 11px; line-height: 1.6; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`;

export const runCss = `
.head { display: flex; flex-wrap: wrap; gap: 12px 20px; justify-content: space-between; align-items: flex-start; }
.back { font-size: 12px; }
.badge {
  padding: 5px 12px; border-radius: 999px; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
  box-shadow: inset 0 0 0 1px var(--hair); color: var(--dim);
}
.badge[data-status='FINISHED'] { color: var(--key); box-shadow: inset 0 0 0 1px var(--key); }
.badge[data-status='ERROR'], .badge[data-status='EXPIRED'] { color: var(--bad); box-shadow: inset 0 0 0 1px var(--bad); }
.badge[data-status='CANCELLED'], .badge[data-status='RUNNING'] { color: var(--warn); box-shadow: inset 0 0 0 1px var(--warn); }

.facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0; }
.facts > div { padding: 12px 14px; border-radius: 12px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); }
.facts dt { color: var(--dim); font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
.facts dd { margin: 6px 0 0; font-size: 15px; overflow-wrap: anywhere; }
@media (max-width: 760px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.scope { display: grid; gap: 14px; padding: 14px; border-radius: 18px; background: var(--panel-2); box-shadow: inset 0 0 0 1px var(--hair); }
.screen { display: grid; gap: 14px; padding: 16px 18px; border-radius: 10px; background: var(--screen); color: var(--screen-ink); min-width: 0; }
.wf { position: relative; display: grid; gap: 8px; --label: 84px; --t: 0; }
.lane { display: grid; grid-template-columns: var(--label) minmax(0, 1fr); align-items: center; gap: 12px; color: var(--screen-dim); font-size: 11px; --bar: #8e9aa6; }
.lane[data-kind='thinking'] { --bar: #8e8e87; }
.lane[data-kind='read'] { --bar: #9db4cf; }
.lane[data-kind='search'] { --bar: #b7a4dc; }
.lane[data-kind='edit'] { --bar: var(--glow); }
.lane[data-kind='shell'] { --bar: #7fd6c3; }
.lane[data-kind='other'] { --bar: #d6bd72; }
.track { position: relative; height: 18px; border-radius: 3px; background: repeating-linear-gradient(90deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 5%); }
.track i { position: absolute; inset-block: 2px; border-radius: 2px; background: var(--bar); opacity: 0.22; transition: opacity 180ms; }
.track i[data-state='done'] { opacity: 0.95; }
.track i[data-state='live'] { opacity: 1; box-shadow: 0 0 10px color-mix(in oklab, var(--bar) 70%, transparent); }
.track i[data-failed] { background: #e0685a; }
.playhead {
  position: absolute; inset-block: -4px; width: 2px; background: #fff; pointer-events: none;
  left: calc(var(--label) + 12px + (100% - var(--label) - 12px) * var(--t)); box-shadow: 0 0 10px rgb(255 255 255 / 0.7);
}
@media (max-width: 860px) { .wf { --label: 60px; } }

.feed { display: grid; align-content: start; gap: 2px; max-height: 300px; margin: 0; padding: 0; overflow-y: auto; list-style: none; font-size: 11px; scrollbar-width: thin; }
.feed li.idle { color: var(--screen-dim); padding: 4px 0; }
.feed li { animation: line 260ms ease-out; }
@keyframes line { from { opacity: 0; transform: translateY(5px); } }
.row {
  all: unset; box-sizing: border-box; display: grid; grid-template-columns: 62px minmax(0, 1fr) auto; gap: 2px 12px;
  align-items: baseline; width: 100%; padding: 4px 6px; border-radius: 4px; cursor: pointer; color: #b9b9b2;
}
.row:hover, .row:focus-visible { background: rgb(255 255 255 / 0.07); }
.row:focus-visible { outline: 2px solid var(--glow); }
.row .when { color: #77776f; font-variant-numeric: tabular-nums; }
.row .what { min-width: 0; overflow: hidden; color: #fff; text-overflow: ellipsis; white-space: nowrap; }
.row .took { color: #77776f; }
.row .detail {
  grid-column: 2 / -1; display: -webkit-box; overflow: hidden; color: #a2a29b; line-height: 1.55; white-space: pre-wrap;
  -webkit-box-orient: vertical; -webkit-line-clamp: 4; line-clamp: 4; overflow-wrap: anywhere;
}
.feed li[data-kind='assistant'] .what { color: var(--glow); }
.feed li[data-kind='thinking'] .what { color: #8e8e87; }
.feed li[data-failed] .what { color: #ff8a7a; }

.controls { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 14px 28px; }
.readouts { display: flex; flex-wrap: wrap; gap: 10px; }
.lcd { display: grid; gap: 2px; min-width: 84px; padding: 6px 12px; border-radius: 8px; background: var(--screen); color: var(--glow); }
.lcd .tag { color: var(--screen-dim); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
.lcd .val { font-size: 18px; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
.transport { display: grid; grid-template-columns: auto minmax(120px, 1fr) auto; align-items: center; gap: 16px; }
.btn {
  min-width: 72px; padding: 8px 16px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--key); color: var(--bg); font-weight: 600; letter-spacing: 0.04em;
}
.btn:hover { filter: brightness(1.08); }
#playhead { width: 100%; accent-color: var(--key); height: 28px; }
.speed-box { display: inline-flex; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--hair); overflow: hidden; }
.speed { border: 0; background: transparent; padding: 6px 12px; cursor: pointer; color: var(--dim); }
.speed[aria-pressed='true'] { background: var(--key-soft); color: var(--key); font-weight: 600; }
@media (max-width: 860px) { .controls { grid-template-columns: minmax(0, 1fr); } .transport { grid-template-columns: auto minmax(0, 1fr); } .speed-box { grid-column: 1 / -1; justify-self: start; } }

.columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
@media (max-width: 860px) { .columns { grid-template-columns: minmax(0, 1fr); } }

.verdict { display: grid; gap: 16px; }
.vhead { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; font-size: 11px; }
.tier { padding: 4px 12px; border-radius: 999px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; box-shadow: inset 0 0 0 1px var(--hair); }
.tier[data-tier='low'] { color: var(--key); box-shadow: inset 0 0 0 1px var(--key); }
.tier[data-tier='medium'] { color: var(--warn); box-shadow: inset 0 0 0 1px var(--warn); }
.tier[data-tier='high'] { color: var(--bad); box-shadow: inset 0 0 0 1px var(--bad); }
.vsummary { margin: 0; font-family: var(--sans); font-size: 17px; letter-spacing: -0.015em; line-height: 1.4; overflow-wrap: anywhere; }
.checks { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.checks li { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 12px; align-items: start; padding: 10px 12px; border-radius: 8px; background: var(--panel-2); }
.checks li[data-verdict='fail'] { background: var(--bad-soft); }
.mark { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--dim); color: var(--bg); font-weight: 700; }
.checks li[data-verdict='pass'] .mark { background: var(--key); }
.checks li[data-verdict='fail'] .mark { background: var(--bad); }
.checks li[data-verdict='unclear'] .mark { background: var(--warn); }
.checks strong { display: block; font-weight: 600; overflow-wrap: anywhere; }
.checks em { display: block; margin-top: 2px; color: var(--dim); font-size: 11px; font-style: normal; overflow-wrap: anywhere; }
.files { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.files code, .vfacts code { padding: 1px 6px; border-radius: 4px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); font-size: 11px; overflow-wrap: anywhere; }
.vfacts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.vfacts h3 { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); margin-bottom: 6px; }
.vfacts p, .vfacts ul { margin: 0; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.vfacts ul { padding-left: 16px; }
@media (max-width: 860px) { .vfacts { grid-template-columns: minmax(0, 1fr); } }
details { font-size: 12px; }
summary { cursor: pointer; color: var(--dim); }
.decided { font-size: 13px; overflow-wrap: anywhere; }
.decided[data-decision='approved'] strong { color: var(--key); }
.decided[data-decision='rejected'] strong { color: var(--bad); }
.decided[data-decision='changes-requested'] strong { color: var(--warn); }

.files-list { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; }
.file { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 90px minmax(0, 1fr) 48px 48px; gap: 12px; width: 100%; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.file:hover { background: var(--panel-2); }
.file:focus-visible { outline: 2px solid var(--key); }
.file[aria-current='true'] { background: var(--key-soft); box-shadow: inset 3px 0 0 var(--key); }
.file .status { color: var(--dim); }
.file .path { overflow-wrap: anywhere; }
.file .num { text-align: end; font-variant-numeric: tabular-nums; }
.patch { max-height: 440px; padding: 12px 0; overflow: auto; border-radius: 8px; background: var(--screen); color: #d6d6cf; font-size: 11px; line-height: 1.6; }
.patch div { padding: 0 14px; white-space: pre; }
.patch [data-k='add'] { background: rgb(80 200 140 / 0.16); color: #9be3bd; }
.patch [data-k='del'] { background: rgb(230 100 90 / 0.16); color: #ffa397; }
.patch [data-k='hunk'] { color: #8ea3d6; }
.patch [data-k='meta'] { color: #77776f; }
`;

export const indexCss = `
h1 { margin-bottom: 4px; }
.table-wrap { overflow-x: auto; border-radius: 14px; background: var(--panel); box-shadow: inset 0 0 0 1px var(--hair); }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 10px 14px; text-align: start; vertical-align: baseline; border-bottom: 1px solid var(--hair); white-space: nowrap; }
th { color: var(--dim); font-size: 10px; font-weight: 400; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td.num, th.num { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.task { min-width: 300px; max-width: 46ch; white-space: normal; font-family: var(--sans); font-size: 14px; }
td.task a { color: var(--ink); text-decoration-color: var(--key); text-underline-offset: 3px; overflow-wrap: anywhere; }
td.task small { display: block; margin-top: 2px; color: var(--dim); font: 11px var(--mono); }
.pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; box-shadow: inset 0 0 0 1px var(--hair); color: var(--dim); white-space: nowrap; }
.pill[data-tone='good'] { color: var(--key); box-shadow: inset 0 0 0 1px var(--key); }
.pill[data-tone='warn'] { color: var(--warn); box-shadow: inset 0 0 0 1px var(--warn); }
.pill[data-tone='bad'] { color: var(--bad); box-shadow: inset 0 0 0 1px var(--bad); }
.empty { padding: 28px 18px; text-align: center; }
.problems { font-size: 12px; }
.problems li { overflow-wrap: anywhere; }
`;
