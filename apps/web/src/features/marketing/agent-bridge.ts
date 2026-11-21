'use client';

import { createAgent, createHistory, registerTools } from '@avero/ui';

export type Bridge = {
  agent: ReturnType<typeof createAgent>;
  history: ReturnType<typeof createHistory>;
};

let bridge: Bridge | undefined;

/**
 * One bridge for the whole page. It finds the controls that are already mounted and hears new
 * ones as they appear, so it is safe to create after the first render.
 */
export function getBridge(): Bridge | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!bridge) {
    const agent = createAgent();
    const history = createHistory(agent, {
      within: () => document.querySelector('[data-mk="page"]'),
      keys: ['value'],
    });
    bridge = { agent, history };
  }
  return bridge;
}

type ModelContextDocument = Document & { modelContext?: { registerTool?: unknown } };

/** True when this browser exposes its own agent hook (WebMCP). */
export function browserAgentsSupported(): boolean {
  return typeof (document as ModelContextDocument).modelContext?.registerTool === 'function';
}

/**
 * Offers the same tools to the browser's own agent. Anything marked as needing a person is left
 * to the person: the browser's agent can read it but cannot press it.
 */
export function connectBrowserAgents(): () => void {
  const current = getBridge();
  if (!current) return () => undefined;
  return registerTools(current.agent, { allow: (step) => !step.confirm });
}
