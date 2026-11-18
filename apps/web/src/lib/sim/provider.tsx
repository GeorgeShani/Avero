'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import {
  advance,
  approve,
  cancel,
  createInitialState,
  launch,
  reject,
  retry,
  tickMs,
  type NewTask,
  type SimState,
} from './store';

type Action =
  | { type: 'tick' }
  | { type: 'approve' | 'reject' | 'cancel' | 'retry'; id: string }
  | { type: 'launch'; input: NewTask };

function reduce(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'tick':
      return advance(state);
    case 'approve':
      return approve(state, action.id);
    case 'reject':
      return reject(state, action.id);
    case 'cancel':
      return cancel(state, action.id);
    case 'retry':
      return retry(state, action.id);
    case 'launch': {
      return launch(state, action.input).state;
    }
  }
}

type Sim = {
  state: SimState;
  approve: (id: string) => void;
  reject: (id: string) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  launch: (input: NewTask) => string;
};

const SimContext = createContext<Sim | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, undefined, createInitialState);

  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick' }), tickMs);
    return () => clearInterval(id);
  }, []);

  const sim = useMemo<Sim>(
    () => ({
      state,
      approve: (id) => dispatch({ type: 'approve', id }),
      reject: (id) => dispatch({ type: 'reject', id }),
      cancel: (id) => dispatch({ type: 'cancel', id }),
      retry: (id) => dispatch({ type: 'retry', id }),
      launch: (input) => {
        dispatch({ type: 'launch', input });
        return `task-${state.nextTask}`;
      },
    }),
    [state],
  );

  return <SimContext value={sim}>{children}</SimContext>;
}

export function useSim(): Sim {
  const sim = useContext(SimContext);
  if (!sim) throw new Error('useSim must be used inside SimProvider');
  return sim;
}
