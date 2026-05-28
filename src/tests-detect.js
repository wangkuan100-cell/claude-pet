const TEST_CMD = /(^|\s|&&|;|\|)(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|vitest|jest|mocha|pytest|py\.test|unittest|go\s+test|cargo\s+test|node\s+--test|rspec|phpunit|gradle\s+test|mvn\s+test/i;
const PASS = /\b(\d+\s+passed|all tests passed|tests?\s+passed|ok\b|✓|PASS\b)/i;
// Only treat a NON-ZERO failure/error count (or an explicit FAIL/✗ marker) as failure,
// so "5 passed, 0 failed" is still a success.
const FAIL = /[1-9]\d*\s+(failed|failures|errors?)|✗|\bFAIL\b/i;

export function isTestCommand(cmd) {
  return TEST_CMD.test(cmd || '');
}

export function isTestSuccess(output, exitCode) {
  if (exitCode !== null && exitCode !== undefined) return exitCode === 0;
  const text = output || '';
  return PASS.test(text) && !FAIL.test(text);
}
