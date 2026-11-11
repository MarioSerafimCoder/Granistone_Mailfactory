import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localSaveQueue } from '../lib/local-save-queue';

test('slow storage coalesces typing and flush waits for the latest durable snapshot', async () => {
  const written: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const save = localSaveQueue(async (value: string) => { if (value === 'a') await gate; written.push(value); });
  const first = save('a');
  await new Promise(resolve => setImmediate(resolve));
  const second = save('ab'), third = save('abc');
  let flushed = false;
  void third.then(() => { flushed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(flushed, false);
  release();
  await Promise.all([first, second, third]);
  assert.deepEqual(written, ['a', 'abc']);
  await save('abcd');
  assert.deepEqual(written, ['a', 'abc', 'abcd']);
});

test('a failed write stays pending and cannot falsely acknowledge a queued flush', async () => {
  let attempts = 0;
  const save = localSaveQueue(async () => { attempts++; throw new Error('disk unavailable'); });
  const first = save('a'), latest = save('ab');
  const results = await Promise.allSettled([first, latest]);
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(attempts, 2);
});
