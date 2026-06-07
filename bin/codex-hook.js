#!/usr/bin/env node
import fs from 'node:fs';
import { processActivityPayload } from '../src/activity.js';

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function main() {
  const raw = readStdin();
  let payload;
  try { payload = JSON.parse(raw); } catch { return; }
  processActivityPayload({ provider: 'codex', ...payload }, { defaultProvider: 'codex' });
}

try { main(); } catch { /* never block Codex */ } finally { process.exit(0); }
