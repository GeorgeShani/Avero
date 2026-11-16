import process from 'node:process';

export function writeLog(
  level: 'info' | 'error',
  event: string,
  details: Record<string, string | number> = {},
): void {
  const output = level === 'error' ? process.stderr : process.stdout;
  output.write(JSON.stringify({ ...details, at: new Date().toISOString(), level, event }) + '\n');
}
