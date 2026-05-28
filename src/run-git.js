import { spawnSync } from 'node:child_process';

const ALLOWED = new Set(['status', 'log', 'tag', 'rev-parse', 'config', 'describe']);

export function makeGitRunner(cwd) {
  return function runGit(args) {
    if (!ALLOWED.has(args[0])) {
      throw new Error(`refusing non-read-only git subcommand: ${args[0]}`);
    }
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return { code: r.status ?? 1, stdout: r.stdout || '' };
  };
}
