import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler } from '../src/app.js';
import { demoWords, generateWords, validateWords } from '../src/words.js';
async function fixture(t, options) {
  const server = createServer(createHandler(options)); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;
  return (path = '/ask', init) => fetch(url + path, init);
}
test('GET /ask preserves the assignment contract', async t => {
  const request = await fixture(t, { env: { WORD_PROVIDER: 'demo' } });
  const response = await request(); assert.equal(response.status, 200); assert.deepEqual(await response.json(), demoWords);
});
test('CORS allows configured frontend and rejects another origin', async t => {
  const request = await fixture(t, { env: { WORD_PROVIDER: 'demo', ALLOWED_ORIGINS: 'https://example.com' } });
  assert.equal((await request('/ask', { headers: { Origin: 'https://evil.example' } })).status, 403);
  const allowed = await request('/ask', { headers: { Origin: 'https://example.com' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://example.com');
  assert.equal((await request('/ask', { method: 'OPTIONS', headers: { Origin: 'https://example.com' } })).status, 204);
});
test('missing credentials fail explicitly without returning demo data', async t => {
  const request = await fixture(t, { env: {} }); assert.equal((await request()).status, 503);
});
test('rate limit blocks the eleventh request', async t => {
  const request = await fixture(t, { env: { WORD_PROVIDER: 'demo' } });
  for (let i = 0; i < 10; i++) assert.equal((await request()).status, 200);
  const blocked = await request(); assert.equal(blocked.status, 429); assert.ok(blocked.headers.get('retry-after'));
});
test('provider failures do not leak internals and can be retried', async t => {
  let fail = true;
  const request = await fixture(t, { env: { OPENAI_API_KEY: 'test-only' }, provider: async () => { if (fail) throw new Error('secret'); return demoWords; } });
  const failed = await request(); assert.equal(failed.status, 502); assert.ok(!(await failed.text()).includes('secret'));
  fail = false; assert.equal((await request()).status, 200);
});
test('concurrent requests share provider call; cache expires', async t => {
  let calls = 0; let time = 0;
  const request = await fixture(t, { env: { OPENAI_API_KEY: 'test-only' }, now: () => time, provider: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 30)); return demoWords; } });
  await Promise.all([request(), request(), request()]); assert.equal(calls, 1);
  time = 16000; await request(); assert.equal(calls, 2);
});
test('invalid provider output and duplicated words are rejected', () => {
  assert.throws(() => validateWords([{ word: 'incomplete' }]));
  assert.throws(() => validateWords(Array(5).fill(demoWords[0])));
  assert.deepEqual(validateWords(demoWords), demoWords);
});
test('OpenAI adapter sends server-side credentials and extracts structured output', async () => {
  const words = await generateWords({ apiKey: 'test-only', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    assert.equal(JSON.parse(options.body).text.format.type, 'json_schema');
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ words: demoWords }) }] }] });
  } }); assert.deepEqual(words, demoWords);
});
test('OpenAI refusal, incomplete output and HTTP error are rejected', async () => {
  for (const response of [Response.json({}, { status: 429 }), Response.json({ status: 'incomplete' }), Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] })]) {
    await assert.rejects(generateWords({ apiKey: 'test-only', fetchImpl: async () => response }));
  }
});
test('unsupported route and method return proper status codes', async t => {
  const request = await fixture(t, { env: { WORD_PROVIDER: 'demo' } });
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/ask', { method: 'POST' })).status, 405);
});
