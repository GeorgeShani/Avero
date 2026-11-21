// Runs once when the server starts (Next.js calls it in every runtime, so the Node-only part is
// imported only where it can run).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWebTelemetry } = await import('./server/telemetry');
    startWebTelemetry();
  }
}
