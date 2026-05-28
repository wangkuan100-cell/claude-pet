const KNOWN = new Set(['feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'chore']);

export function classifyCommit(message) {
  const m = /^(\w+)(\([^)]*\))?!?:/.exec((message || '').trim());
  if (m && KNOWN.has(m[1])) return m[1];
  return 'other';
}
