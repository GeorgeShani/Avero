#!/usr/bin/env node
/**
 * The `avero` command. Subcommands that take their own flags (bench, and the sharing commands)
 * are handled here, before the rest of the commands in cli.ts, so one set of flags never has to
 * know about the other.
 */
import process from 'node:process';

const command = process.argv[2];
const sharing = ['export', 'trace', 'serve', 'mcp'];

try {
  if (command === 'bench') {
    const { benchCli } = await import('./bench.ts');
    process.exitCode = await benchCli(process.argv.slice(3));
  } else if (command && sharing.includes(command)) {
    const { shareCli } = await import('./share.ts');
    const code = await shareCli(command, process.argv.slice(3));
    // `mcp` returns when the client disconnects; the others when they are done.
    process.exitCode = code;
  } else {
    await import('./cli.ts');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The command failed.');
  process.exitCode = 1;
}
