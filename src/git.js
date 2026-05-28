// git --format outputs "<hash> <field>"; a hash never contains a space, so we
// split on the FIRST space only and keep the rest (the commit subject) intact.
function splitFirst(line) {
  const i = line.indexOf(' ');
  return i === -1 ? [line, ''] : [line.slice(0, i), line.slice(i + 1)];
}

export function gitSnapshot(runGit, now = new Date()) {
  const inside = runGit(['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') return { isRepo: false };

  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  const status = runGit(['status', '--porcelain']).stdout;
  const dirtyCount = status.split('\n').filter((l) => l.trim().length > 0).length;

  const log = runGit(['log', '-1', '--format=%H %ct']);
  let lastCommitHash = null, minsSinceLastCommit = null;
  if (log.code === 0 && log.stdout.trim()) {
    const [hash, ct] = splitFirst(log.stdout.trim());
    lastCommitHash = hash;
    minsSinceLastCommit = Math.round((now.getTime() / 1000 - Number(ct)) / 60);
  }
  return { isRepo: true, branch, dirtyCount, lastCommitHash, minsSinceLastCommit };
}

export function newCommitsSince(runGit, lastSeenHash) {
  const fmt = '--format=%H %s';
  if (!lastSeenHash) {
    const head = runGit(['log', '-1', fmt]);
    if (head.code !== 0 || !head.stdout.trim()) return [];
    const [hash, message] = splitFirst(head.stdout.trim());
    return [{ hash, message }];
  }
  const out = runGit(['log', `${lastSeenHash}..HEAD`, fmt]);
  if (out.code !== 0) return [];
  return out.stdout
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      const [hash, message] = splitFirst(l);
      return { hash, message };
    });
}
