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
  processActivityPayload(payload, { defaultProvider: 'claude' });
}

try { main(); } catch { /* never block Claude */ } finally { process.exit(0); }
