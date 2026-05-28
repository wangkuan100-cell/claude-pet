#!/usr/bin/env node
// SessionStart helper: only launches when the user opted in.
import { ensureRunning } from '../widget/launcher.js';
if (process.env.CLAUDE_PET_AUTOLAUNCH === '1') {
  try { ensureRunning(); } catch { /* never block the session */ }
}
