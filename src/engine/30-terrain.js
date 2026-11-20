const N = 50, CS = 20;
const seasonOf = t => Math.floor((t % 360) / 90);
const cellAt = (x, y) => clamp(Math.floor(y / CS), 0, N - 1) * N + clamp(Math.floor(x / CS), 0, N - 1);
function genTerrain(S) {
  const grid = () => { const a = []; for (let i = 0; i < 64; i++) a.push(rnd(S)); return a; };
  const E1 = grid(), E2 = grid(), M1 = grid();
  const sm = t => t * t * (3 - 2 * t);
  const vn = (A, u, v, f) => { const gx = u * f, gy = v * f, ix = Math.floor(gx), iy = Math.floor(gy), fx = sm(gx - ix), fy = sm(gy - iy), at = (i, j) => A[(j % 8) * 8 + (i % 8)]; const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  // island: coastline radius varies with angle
  const ph = [rnd(S) * 6.28, rnd(S) * 6.28, rnd(S) * 6.28], amp = [40 + rnd(S) * 40, 25 + rnd(S) * 30, 15 + rnd(S) * 20], cx0 = 500 + gauss(S) * 15, cy0 = 500 + gauss(S) * 15;
  const RAD = (x, y) => { const a = Math.atan2(y - cy0, x - cx0); return 430 + amp[0] * Math.sin(2 * a + ph[0]) + amp[1] * Math.sin(3 * a + ph[1]) + amp[2] * Math.sin(5 * a + ph[2]); };
  S.isle = { x: cx0, y: cy0 };
  const sea = (x, y) => Math.hypot(x - cx0, y - cy0) > RAD(x, y) + (vn(E2, x / 1000, y / 1000, 6) - 0.5) * 50;
  // river: from the highlands near the centre down to the sea
  const pts = []; let x = cx0 + gauss(S) * 90, dx = 0, src = cy0 - 140 - rnd(S) * 80, mouth = null;
  for (let y = -20; y <= 1020; y += 20) {
    if (y < src || mouth !== null) { pts.push([-10000, y]); continue; }
    dx = dx * 0.82 + gauss(S) * 10; x = clamp(x + dx, 160, 840); pts.push([Math.round(x), y]);
    if (sea(x, y + 20)) mouth = y;
  }
  S.river = pts; S.riverSrc = src;
  let ter = ''; const wood = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cx = i * CS + 10, cy = j * CS + 10, u = i / N, v = j / N;
    const rr = Math.hypot(cx - cx0, cy - cy0) / RAD(cx, cy), inl = clamp(1 - rr, 0, 1);
    const el = vn(E1, u, v, 3) * 0.6 + vn(E2, u, v, 7) * 0.32 + inl * 0.14, mo = vn(M1, u, v, 4);
    const rx = pts[clamp(Math.round((cy + 20) / 20), 0, pts.length - 1)][0], dr = Math.abs(cx - rx);
    let t = 'g';
    if (sea(cx, cy)) t = 's';
    else if (dr < 15) t = 'w'; else if (el > 0.66 && dr > 50) t = 'h'; else if (mo > 0.57 && dr > 45) t = 'f'; else if ((dr < 110 && el < 0.62) || el < 0.36) t = 'r';
    ter += t; wood.push(t === 'f' ? 60 : 0);
  }
  // beaches: land next to sea
  const T = ter.split('');
  for (let c = 0; c < N * N; c++) { if (T[c] === 's' || T[c] === 'w') continue; const ci = c % N, cj = (c / N) | 0; let sea1 = false; for (const [dx2, dy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (cj + dy2) * N + ci + dx2; if (ci + dx2 < 0 || cj + dy2 < 0 || ci + dx2 >= N || cj + dy2 >= N || T[q] === 's') sea1 = true; } if (sea1) { T[c] = 'b'; wood[c] = 0; } }
  S.ter = T.join(''); S.wood = wood;
}
