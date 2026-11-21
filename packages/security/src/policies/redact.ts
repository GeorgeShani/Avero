export function redactSecrets(text: string, secrets: readonly string[]): string {
  const values = [...new Set(secrets.filter(Boolean))].sort(
    (left, right) => right.length - left.length,
  );
  if (values.length === 0) return text;

  return text.replace(
    new RegExp(values.map((value) => RegExp.escape(value)).join('|'), 'g'),
    '[redacted]',
  );
}
