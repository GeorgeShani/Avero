import process from 'node:process';
import { Cursor } from '@cursor/sdk';
import { runCursorSmoke, SmokeCheckError } from './smoke.ts';

const command = process.argv[2];

try {
  switch (command) {
    case 'login':
      await Cursor.auth.login({ signal: AbortSignal.timeout(180_000) });
      console.log('Cursor SDK sign-in completed.');
      break;
    case 'auth':
      await Cursor.me();
      console.log('Cursor SDK credential accepted.');
      break;
    case 'smoke': {
      const model = process.env.AVERO_CURSOR_MODEL?.trim() || 'composer-2.5';
      const result = await runCursorSmoke(model, (event) => console.log(JSON.stringify(event)));
      console.log(JSON.stringify({ type: 'smoke.passed', ...result }));
      break;
    }
    default:
      throw new SmokeCheckError('Usage: node dist/cursor/cli.js <login|auth|smoke>');
  }
} catch (error) {
  if (error instanceof SmokeCheckError) {
    console.error(error.message);
  } else {
    const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
    console.error(
      'Cursor SDK command failed (' + errorType + '). Check connectivity and credentials.',
    );
  }
  process.exitCode = 1;
}
