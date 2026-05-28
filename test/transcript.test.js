import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTranscriptUsage } from '../src/transcript.js';

const sample = [
  '{"type":"user","message":{"role":"user"}}',
  '{"type":"assistant","message":{"usage":{"input_tokens":1000,"output_tokens":200,"cache_read_input_tokens":3000}}}',
  'not json — should be skipped',
  '{"type":"assistant","message":{"usage":{"input_tokens":1500,"output_tokens":300,"cache_read_input_tokens":5000}}}',
].join('\n');

test('parseTranscriptUsage sums tokens and reports last context size', () => {
  const u = parseTranscriptUsage(sample);
  assert.equal(u.totalInputTokens, 2500);
  assert.equal(u.totalOutputTokens, 500);
  assert.equal(u.totalTokens, 3000);
  // last assistant message context ≈ input + cache tokens of the final usage
  assert.equal(u.lastContextTokens, 1500 + 5000);
});

test('parseTranscriptUsage tolerates empty input', () => {
  const u = parseTranscriptUsage('');
  assert.deepEqual(u, { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, lastContextTokens: 0 });
});
