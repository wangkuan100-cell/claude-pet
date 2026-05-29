// Pure helpers for the opt-in desktop-edge wandering (main owns the timer + setPosition).

// Pick a random spot along the BOTTOM edge of the work area for the window's top-left.
export function pickWanderTarget(workArea, winSize, rng = Math.random) {
  const maxX = Math.max(0, workArea.width - winSize.width);
  const x = Math.round(rng() * maxX);
  const y = Math.max(0, workArea.height - winSize.height); // sit on the bottom edge
  return { x, y };
}

// Eased step path of [x,y] positions from `from` to `to` over `steps` frames (easeInOutQuad).
export function glidePath(from, to, steps = 30) {
  const n = Math.max(1, steps);
  const path = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    path.push([Math.round(from[0] + (to[0] - from[0]) * e), Math.round(from[1] + (to[1] - from[1]) * e)]);
  }
  return path;
}
