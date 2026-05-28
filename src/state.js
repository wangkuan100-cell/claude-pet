import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA_VERSION, MOOD_INIT } from './constants.js';

export function baseDir() {
  return process.env.CLAUDE_PET_HOME || path.join(os.homedir(), '.claude-pet');
}
export const petPath = () => path.join(baseDir(), 'pet.json');
export const statusPath = () => path.join(baseDir(), 'status.json');

export function defaultPet(nowIso = new Date().toISOString()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    species: null,
    name: null,
    birthday: nowIso,
    xp: 0,
    level: 1,
    stage: 'egg',
    mood: MOOD_INIT,
    lastActivityAt: nowIso,
    recentFailureUntil: null,
    streak: { days: 1, lastActiveDate: nowIso.slice(0, 10) },
    achievements: [],
    lifetime: { linesAdded: 0, tokens: 0, sessions: 0, commits: 0, testsPassed: 0, features: 0, releases: 0 },
    repos: {},
  };
}

function writeAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function loadPet() { return readJson(petPath(), defaultPet()); }
export function savePet(pet) { writeAtomic(petPath(), pet); }
export function loadStatus() { return readJson(statusPath(), null); }
export function saveStatus(status) { writeAtomic(statusPath(), status); }
