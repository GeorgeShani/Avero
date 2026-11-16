const reviewFiles = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
]);

export function assessChange(paths: readonly string[]) {
  const reviewPaths = [...new Set(paths)].filter((path) => {
    const file = path.split('/').at(-1) ?? '';
    return reviewFiles.has(file) || path.startsWith('.github/workflows/');
  });

  return {
    verdict: reviewPaths.length > 0 ? 'Dependency or workflow review required' : 'Standard review',
    reviewPaths,
  };
}
