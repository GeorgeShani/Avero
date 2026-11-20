import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Runs git in a folder and returns its output. Throws with git's own message on failure. */
export async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-c', 'core.quotepath=off', ...args], {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 60_000,
    });
    return stdout;
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const detail = typeof stderr === 'string' && stderr.trim() ? stderr.trim() : String(error);
    throw new Error(`git ${args.slice(0, 2).join(' ')} failed: ${detail.slice(0, 500)}`);
  }
}

export type ShellResult = {
  /** Null when the command could not start, or was stopped for taking too long. */
  exitCode: number | null;
  timedOut: boolean;
  /** The end of the combined output. */
  output: string;
};

const keepChars = 3000;

/**
 * Runs a shell command in a folder, such as a repository's test command, and reports how it
 * ended. The command is the user's own (they wrote it into the suite), run on their machine.
 */
export function shell(cwd: string, command: string, timeoutMs: number): Promise<ShellResult> {
  return new Promise((resolve) => {
    let output = '';
    let timedOut = false;
    const child = spawn(command, { cwd, shell: true, windowsHide: true });
    const keep = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (output.length > keepChars * 4) output = output.slice(-keepChars * 2);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ exitCode: null, timedOut, output: `Could not start: ${error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const text = output.trim();
      resolve({
        exitCode: timedOut ? null : code,
        timedOut,
        output: text.length > keepChars ? `…${text.slice(-keepChars)}` : text,
      });
    });
  });
}
