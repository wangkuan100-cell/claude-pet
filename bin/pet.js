#!/usr/bin/env node
import { loadPet, savePet, loadStatus } from '../src/state.js';
import { applyEvent } from '../src/engine.js';

const SPECIES = ['cat', 'dog', 'dragon', 'slime', 'bird', 'fox'];
const [cmd = 'status', ...rest] = process.argv.slice(2);

function printStatus() {
  const pet = loadPet();
  const status = loadStatus();
  const name = pet.name || (pet.species ? pet.species : 'egg');
  console.log(`${name} — Lv ${pet.level} (${pet.stage}), mood ${pet.mood}, xp ${pet.xp}`);
  if (pet.species === null) console.log('Not adopted yet — run: /pet adopt <species>  (' + SPECIES.join(', ') + ')');
  console.log(`achievements: ${pet.achievements.map((a) => a.id).join(', ') || 'none'}`);
  if (status) {
    console.log(`project: ${status.repo || status.cwd} | context ${status.contextUsedPct}% | $${status.sessionCostUsd}`);
    if (status.alerts.length) console.log(`alerts: ${status.alerts.join(', ')}`);
  }
}

if (cmd === 'status') {
  printStatus();
} else if (cmd === 'adopt') {
  const species = rest[0];
  if (!SPECIES.includes(species)) {
    console.error(`unknown species: ${species}. choose one of: ${SPECIES.join(', ')}`);
    process.exit(1);
  }
  const pet = loadPet();
  pet.species = species;
  savePet(pet);
  console.log(`Adopted a ${species}! It will hatch as you code.`);
} else if (cmd === 'rename') {
  const name = rest.join(' ').trim();
  if (!name) { console.error('usage: /pet rename <name>'); process.exit(1); }
  const pet = loadPet();
  pet.name = name;
  savePet(pet);
  console.log(`Renamed to ${name}.`);
} else if (cmd === 'milestone') {
  const pet = loadPet();
  const { pet: updated } = applyEvent(pet, { linesXp: 0, testXp: 0 }, { type: 'milestone' }, new Date());
  savePet(updated);
  console.log(`Milestone logged: "${rest.join(' ')}" (+300 xp). Now Lv ${updated.level}.`);
} else if (cmd === 'start') {
  const { start } = await import('../widget/launcher.js');
  const electronPath = process.env.CLAUDE_PET_FAKE_ELECTRON || undefined;
  const r = start(electronPath ? { electronPath } : {});
  console.log(r.started ? `Widget started (pid ${r.pid}).` : `Widget ${r.reason}.`);
} else if (cmd === 'stop') {
  const { stop } = await import('../widget/launcher.js');
  const r = stop();
  console.log(r.stopped ? 'Widget stopped.' : 'Widget was not running.');
} else {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}
