import assert from 'node:assert/strict';
import test from 'node:test';
import { deliver } from './deliver.js';

test('delivers a payload the receiver accepts', async () => {
  const sent = [];
  const ok = await deliver(
    async (payload) => {
      sent.push(payload);
      return { ok: true };
    },
    { id: 1 },
  );
  assert.equal(ok, true);
  assert.deepEqual(sent, [{ id: 1 }]);
});

test('reports a payload the receiver rejects', async () => {
  const ok = await deliver(async () => ({ ok: false }), { id: 2 });
  assert.equal(ok, false);
});
