/**
 * The agent bridge: lets an agent read the state of the page's controls and call their
 * actions directly (no clicking, no screenshots, no browser automation).
 */
export { agentTools, createAgent, registerTools } from '@ui-sdk/react/agent';
export type { AgentAction, AgentChange, AgentComponent, AgentStep } from '@ui-sdk/react/agent';
export { createHistory, describeEntry } from '@ui-sdk/react/history';
export type { HistoryEntry } from '@ui-sdk/react/history';
export { elementOf } from '@ui-sdk/react/observe';
export type { ObservedChange } from '@ui-sdk/react/observe';
