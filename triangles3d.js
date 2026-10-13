/* Triangle mesh background that looks three-dimensional, emerald / gold palette.
   The same triangular mesh as before, but every vertex now has a height, so the mesh is a
   low-poly relief. Each facet is shaded by how its normal faces a light:
   - the light sits where the pointer is (a point light slightly above the surface), so the
     facets facing the pointer brighten, with a faint gold highlight on the brightest ones
   - the surface rises into a soft hill under the pointer and falls back when it leaves
   - higher points shift a little against the pointer (parallax), which sells the depth
   Facets are painted opaque in the page colour -> emerald range, so overlapping looks like
   a real surface. Phones / reduced motion: one static frame with a fixed light. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('tri');
  if (!cv) return;
  const ctx = cv.getContext('2d');

  const SIZE = 96;                 // edge length of one triangle (px)
  const RELIEF = SIZE * 0.55;      // amplitude of the terrain
  const RADIUS = 230;              // pointer influence radius
  const BUMP = SIZE * 1.2;         // height of the hill under the pointer
  const LIGHT_Z = 230;             // height of the light above the surface
  const PAGE = [15, 18, 16], EMERALD = [16, 185, 129], MINT = [110, 231, 183], GOLD = [230, 183, 90];

  const mouse = { x: -9999, y: -9999 };
  let W, H, dpr, cols, rows, pts = [], tris = [], raf = 0;
  const par = { x: 0, y: 0 };      // eased parallax of the heights

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function terrain(x, y) {
    return RELIEF * (
      Math.sin(x * 0.0105 + 1.3) * Math.cos(y * 0.0125 + 0.4) +
      0.6 * Math.sin(x * 0.0265 + y * 0.0185) +
      0.4 * Math.cos(x * 0.043 - y * 0.031 + 2.0));
  }

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rowH = SIZE * 0.866;
    cols = Math.ceil(W / SIZE) + 4;
    rows = Math.ceil(H / rowH) + 5;

    pts = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - 2) * SIZE + (r % 2 ? SIZE / 2 : 0) + (Math.random() - 0.5) * SIZE * 0.18;
        const y = (r - 2) * rowH + (Math.random() - 0.5) * SIZE * 0.18;
        const z0 = terrain(x, y) + (Math.random() - 0.5) * SIZE * 0.22;
        pts.push({ x, y, z0, z: z0, sx: x, sy: y });
      }
    }
    tris = [];
    const at = (r, c) => r * cols + c;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const quad = r % 2
          ? [[at(r, c), at(r + 1, c), at(r + 1, c + 1)], [at(r, c), at(r, c + 1), at(r + 1, c + 1)]]
          : [[at(r, c), at(r, c + 1), at(r + 1, c)], [at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)]];
        quad.forEach((v) => tris.push({ v }));
      }
    }
    wake();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    let moving = false;
    const has = mouse.x > -9000;

    // parallax factors from the pointer
    const tx = has ? -(mouse.x / W - 0.5) * 0.30 : -0.04, ty = has ? -(mouse.y / H - 0.5) * 0.14 : 0;
    par.x += (tx - par.x) * 0.08; par.y += (ty - par.y) * 0.08;
    if (Math.abs(tx - par.x) > 0.0005 || Math.abs(ty - par.y) > 0.0005) moving = true;

    // heights: terrain + a hill under the pointer, eased
    for (const p of pts) {
      let target = p.z0;
      if (has) {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y), k = Math.max(0, 1 - d / RADIUS);
        target += BUMP * k * k;
      }
      p.z += (target - p.z) * 0.12;
      if (Math.abs(target - p.z) > 0.2) moving = true;
      // oblique projection: height lifts the point on screen, parallax slides it sideways
      p.sx = p.x + p.z * par.x;
      p.sy = p.y - p.z * 0.42 + p.z * par.y;
    }

    // colours never depend on the pointer: a fixed light from the upper left, and the facets are
    // shaded from their resting heights (z0), so hovering only moves the surface, it does not recolour it
    const lx = W * 0.18, ly = H * 0.12;

    for (const t of tris) {
      const a = pts[t.v[0]], b = pts[t.v[1]], c = pts[t.v[2]];
      // normal of the facet in world space (x, y, z)
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z0 - a.z0;
      const vx = c.x - a.x, vy = c.y - a.y, vz = c.z0 - a.z0;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;

      // direction to the light from the facet centre
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z0 + b.z0 + c.z0) / 3;
      let dx = lx - cx, dy = ly - cy, dz = LIGHT_Z - cz;
      const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      const lam = Math.max(0, nx * dx + ny * dy + nz * dz);
      const I = Math.min(1, Math.pow(lam, 2.2) * 0.9);                    // contrast, independent of the pointer

      let col = mix(PAGE, EMERALD, 0.06 + I * 0.28);                       // dark -> emerald
      if (I > 0.66) col = mix(col, GOLD, Math.min(0.20, (I - 0.66) * 0.6));// a faint gold glint on the brightest facets
      ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.lineTo(c.sx, c.sy); ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${MINT[0]},${MINT[1]},${MINT[2]},${(0.11 + I * 0.32).toFixed(3)})`;
      ctx.stroke();
    }

    raf = moving ? requestAnimationFrame(frame) : 0;     // the loop sleeps when everything is at rest
  }

  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  const isPhone = matchMedia('(hover: none)').matches && Math.min(screen.width, screen.height) < 600;
  const touchOnly = matchMedia('(hover: none)').matches;

  build();
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (!touchOnly || innerWidth !== lastW) { lastW = innerWidth; build(); }
  });
  if (!reduce && !isPhone) {
    addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; wake(); }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; wake(); });
  }
})();
