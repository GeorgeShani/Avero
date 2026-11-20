import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  benchResultSchema,
  benchSuiteSchema,
  hillclimbSchema,
  type BenchResult,
  type BenchSuite,
  type Hillclimb,
} from '@avero/contracts';

const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Bench files live next to the runs folder: `.avero/runs` has `.avero/bench` beside it. */
export function benchRoot(runsDir: string): string {
  return join(dirname(runsDir), 'bench');
}

function checked(id: string, what: string): string {
  if (!slugPattern.test(id)) throw new Error(`That is not a valid ${what} id.`);
  return id;
}

async function readJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return path;
}

const suitePath = (root: string, suiteId: string) =>
  join(root, checked(suiteId, 'suite'), 'suite.json');
const resultPath = (root: string, suiteId: string, resultId: string) =>
  join(root, checked(suiteId, 'suite'), 'results', `${checked(resultId, 'result')}.json`);
const hillclimbPath = (root: string, suiteId: string, id: string) =>
  join(root, checked(suiteId, 'suite'), 'hillclimb', `${checked(id, 'hillclimb')}.json`);

export async function writeSuite(root: string, suite: BenchSuite): Promise<string> {
  return writeJson(suitePath(root, suite.id), benchSuiteSchema.parse(suite));
}

export async function readSuite(root: string, suiteId: string): Promise<BenchSuite | undefined> {
  const json = await readJson(suitePath(root, suiteId));
  return json === undefined ? undefined : benchSuiteSchema.parse(json);
}

export async function listSuites(root: string): Promise<BenchSuite[]> {
  const names = await readdir(root).catch(() => [] as string[]);
  const suites: BenchSuite[] = [];
  for (const name of names.filter((entry) => slugPattern.test(entry))) {
    const suite = await readSuite(root, name).catch(() => undefined);
    if (suite) suites.push(suite);
  }
  return suites.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function writeBenchResult(root: string, result: BenchResult): Promise<string> {
  return writeJson(resultPath(root, result.suiteId, result.id), benchResultSchema.parse(result));
}

export async function readBenchResult(
  root: string,
  suiteId: string,
  resultId: string,
): Promise<BenchResult | undefined> {
  const json = await readJson(resultPath(root, suiteId, resultId));
  return json === undefined ? undefined : benchResultSchema.parse(json);
}

/** Every result for a suite, newest first. A broken file is skipped, not fatal. */
export async function listBenchResults(root: string, suiteId: string): Promise<BenchResult[]> {
  const dir = join(root, checked(suiteId, 'suite'), 'results');
  const names = await readdir(dir).catch(() => [] as string[]);
  const results: BenchResult[] = [];
  for (const name of names.filter((entry) => entry.endsWith('.json'))) {
    const json = await readJson(join(dir, name)).catch(() => undefined);
    const parsed = benchResultSchema.safeParse(json);
    if (parsed.success) results.push(parsed.data);
  }
  return results.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function writeHillclimb(root: string, run: Hillclimb): Promise<string> {
  return writeJson(hillclimbPath(root, run.suiteId, run.id), hillclimbSchema.parse(run));
}

export async function readHillclimb(
  root: string,
  suiteId: string,
  id: string,
): Promise<Hillclimb | undefined> {
  const json = await readJson(hillclimbPath(root, suiteId, id));
  return json === undefined ? undefined : hillclimbSchema.parse(json);
}

export async function listHillclimbs(root: string, suiteId: string): Promise<Hillclimb[]> {
  const dir = join(root, checked(suiteId, 'suite'), 'hillclimb');
  const names = await readdir(dir).catch(() => [] as string[]);
  const runs: Hillclimb[] = [];
  for (const name of names.filter((entry) => entry.endsWith('.json'))) {
    const json = await readJson(join(dir, name)).catch(() => undefined);
    const parsed = hillclimbSchema.safeParse(json);
    if (parsed.success) runs.push(parsed.data);
  }
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
