#!/usr/bin/env node
// Demo: walk the pet through its full evolution on the desktop (egg → hatchling → juvenile →
// adolescent → adult → legendary), pausing at each stage so the user can see it grow up live.
// Writes ~/.claude-pet/pet.json directly; the running widget watches the file and repaints.
//
// Usage:  node bin/demo-lifecycle.mjs              (default: phoenix — has pose2 for adolescent
//         node bin/demo-lifecycle.mjs <species>    + adult + legendary, the richest animation)
//   species ∈ phoenix · dragon · kitsune · cerberus · sphinx · golem
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = process.env.CLAUDE_PET_HOME || path.join(os.homedir(), '.claude-pet');
const PET = path.join(HOME, 'pet.json');
const BACKUP = path.join(os.tmpdir(), `pet-${Date.now()}.bak.json`);

const SPECIES = ['phoenix', 'dragon', 'kitsune', 'cerberus', 'sphinx', 'golem'];
const chosen = process.argv[2] || 'phoenix';
if (!SPECIES.includes(chosen)) {
  console.error(`unknown species: ${chosen}. choose one of: ${SPECIES.join(', ')}`);
  process.exit(1);
}

const STAGES = [
  { label: '🥚 egg (pre-hatch)', level: 1, xp: 0,    stage: 'egg',        species: null,   hold: 4 },
  { label: '🐣 hatchling',        level: 2, xp: 150,  stage: 'hatchling',  species: chosen, hold: 5 },
  { label: '🐤 juvenile',         level: 3, xp: 450,  stage: 'juvenile',   species: chosen, hold: 5 },
  { label: '🐦 adolescent',       level: 4, xp: 1000, stage: 'adolescent', species: chosen, hold: 5 },
  { label: '🦅 adult',            level: 5, xp: 2200, stage: 'adult',      species: chosen, hold: 6 },
  { label: '✨ legendary',        level: 6, xp: 4500, stage: 'legendary',  species: chosen, hold: 8 },
];

// Backup current pet.json so it can be restored after the demo.
if (fs.existsSync(PET)) {
  fs.copyFileSync(PET, BACKUP);
  console.log(`Backed up current pet → ${BACKUP}`);
}

function now() { return new Date().toISOString(); }
function writeStage(s) {
  const t = now();
  const pet = {
    schemaVersion: 1,
    species: s.species,
    name: null,
    birthday: t,
    xp: s.xp,
    level: s.level,
    stage: s.stage,
    mood: 80,
    lastActivityAt: t,
    recentFailureUntil: null,
    streak: { days: 1, lastActiveDate: t.slice(0, 10) },
    achievements: [],
    lifetime: { linesAdded: 0, tokens: 0, sessions: 0, commits: 0, testsPassed: 0, features: 0, releases: 0 },
    repos: {},
  };
  fs.mkdirSync(HOME, { recursive: true });
  fs.writeFileSync(PET, JSON.stringify(pet, null, 2));
}
function sleep(s) { return new Promise((r) => setTimeout(r, s * 1000)); }

const total = STAGES.reduce((a, s) => a + s.hold, 0);
console.log(`\n🐲 ${chosen} lifecycle demo · ${total}s total · watch your desktop widget!\n`);
for (let i = 0; i < STAGES.length; i++) {
  const s = STAGES[i];
  writeStage(s);
  console.log(`  [${i + 1}/${STAGES.length}] ${s.label}  ⏳ ${s.hold}s`);
  await sleep(s.hold);
}
console.log(`\n✨ Done. Pet is at ${chosen} legendary.`);
console.log(`   Restore your previous state with:  cp ${BACKUP} ${PET}`);
