// Eddy the Eagle: wing-frame sprite, curved flights, and the dotted trail he leaves.
// Positions are map positions (stage coords at the US view); MapView converts them
// to the screen so Eddy stays put while the camera moves.
const Eddy = (() => {
  let g, inner, trailPath, badge;
  const frames = {};       // src -> <image>
  let current = null;      // src of the visible frame
  let flapTimer = null;
  let pos = [0, 0];
  let facing = 1;          // 1 = east (art faces right), -1 = west (mirrored)
  let tilt = 0;            // degrees, nose up is negative
  let legs = [];           // finished legs of the route, oldest first (each a list of points)
  let liveLeg = [];        // part of the current leg flown so far

  function init() {
    const cfg = CONFIG.eddy;
    trailPath = MapView.layers.trails.append("path").attr("class", "trail");
    g = MapView.layers.actors.append("g").attr("class", "eddy").style("display", "none");
    inner = g.append("g");
    for (const src of [...cfg.frames.fly, cfg.frames.perch]) {
      frames[src] = inner.append("image").attr("href", src)
        .attr("width", cfg.width).attr("height", cfg.height).style("display", "none");
    }
    if (cfg.badge) badge = inner.append("image").attr("href", cfg.badge.src).style("display", "none");
    MapView.onCamera(render);
    perch();
  }

  function render() {
    const cfg = CONFIG.eddy;
    const ax = cfg.width * cfg.feet[0], ay = cfg.height * cfg.feet[1];
    const px = cfg.width * cfg.pivot[0], py = cfg.height * cfg.pivot[1];
    const [x, y] = MapView.toScreen(pos);
    // Feet sit on `pos`; tilt rotates around the body, not the feet.
    g.attr("transform", `translate(${x},${y}) scale(${facing},1)`);
    inner.attr("transform", `translate(${px - ax},${py - ay}) rotate(${tilt}) translate(${-px},${-py})`);
    renderBadge();

    // Only the newest CONFIG.eddy.maxTrails legs are drawn (the one being flown counts).
    const keep = Math.max(0, CONFIG.eddy.maxTrails - (liveLeg.length > 1 ? 1 : 0));
    const shown = (keep ? legs.slice(-keep) : []).concat(liveLeg.length > 1 ? [liveLeg] : []);
    const d = shown.map(leg => d3.line()(leg.map(MapView.toScreen))).join("");
    trailPath.attr("d", d || null);
  }

  function showFrame(src) {
    if (current === src) return;
    if (current) frames[current].style("display", "none");
    frames[src].style("display", null);
    current = src;
    renderBadge();
  }

  // Shirt logo for the current frame. The whole sprite is mirrored when he faces west;
  // the logo is mirrored back (and its tilt flipped to match) so it always reads "WA".
  function renderBadge() {
    if (!badge || !current) return;
    const cfg = CONFIG.eddy, b = cfg.badge;
    const spot = b.spots[current.split("/").pop().replace(/\.\w+$/, "")];
    badge.style("display", spot ? null : "none");
    if (!spot) return;
    const [fx, fy, fw, rot] = spot;
    const w = fw * cfg.width, h = w * b.aspect;
    badge.attr("width", w).attr("height", h).attr("transform",
      `translate(${fx * cfg.width},${fy * cfg.height}) scale(${facing},1) rotate(${facing * rot}) translate(${-w / 2},${-h / 2})`);
  }

  function startFlap() {
    stopFlap();
    const fly = CONFIG.eddy.frames.fly;
    // Ping-pong through the frames: 0,1,2,1,0,1,2...
    const seq = fly.map((_, i) => i).concat(fly.slice(1, -1).map((_, i) => fly.length - 2 - i));
    let i = 0;
    const step = () => showFrame(fly[seq[i++ % seq.length]]);
    step();
    flapTimer = setInterval(step, 1000 / CONFIG.eddy.flapFps);
  }

  function stopFlap() {
    clearInterval(flapTimer);
    flapTimer = null;
  }

  function perch() {
    stopFlap();
    showFrame(CONFIG.eddy.frames.perch);
    tilt = 0;
    render();
  }

  // Quadratic curve from map position a to b that always bows north. When a == b it
  // is a short hop. The bend is sized on screen at takeoff, so arcs look the same at
  // any zoom; the curve itself lives in map coords, so it rides along if the camera moves.
  function arc(a, b) {
    const A = MapView.toScreen(a), B = MapView.toScreen(b);
    const dx = B[0] - A[0], dy = B[1] - A[1], dist = Math.hypot(dx, dy);
    const lift = Math.max(dist * CONFIG.eddy.arcBend, CONFIG.eddy.minArc);
    let nx = dist ? dy / dist : 0, ny = dist ? -dx / dist : -1;
    if (ny > 0) { nx = -nx; ny = -ny; }
    const cs = [(A[0] + B[0]) / 2 + nx * lift, (A[1] + B[1]) / 2 + ny * lift];
    // Keep the top of the arc (at t = 0.5) on screen with room for Eddy above it.
    const topY = CONFIG.eddy.height * 1.1;
    cs[1] = Math.max(cs[1], 2 * topY - (A[1] + B[1]) / 2);
    const c = MapView.fromScreen(cs);
    const at = t => [0, 1].map(i => (1 - t) ** 2 * a[i] + 2 * (1 - t) * t * c[i] + t * t * b[i]);
    const sample = t => {
      const n = Math.max(2, Math.ceil(80 * t));
      return d3.range(n + 1).map(i => at(t * i / n));
    };
    return { at, sample };
  }

  // Fly to a map position along a curve, leaving a trail. Resolves on landing.
  function flyTo(target, duration) {
    const curve = arc(pos.slice(), target);
    return flyAlong(curve.at, duration, curve.sample);
  }

  // Fly along any path: at(t) gives the map position for t in 0..1.
  // trail(t), if given, returns the points flown so far (kept as part of the route).
  function flyAlong(at, duration, trail = null) {
    const cfg = CONFIG.eddy;
    startFlap();
    return new Promise(resolve => {
      const timer = d3.timer(elapsed => {
        const t = d3.easeSinInOut(Math.min(1, elapsed / duration));
        pos = at(t);
        // Direction of travel on screen, so facing and tilt work at any zoom.
        const a = MapView.toScreen(at(Math.max(0, t - 0.004)));
        const b = MapView.toScreen(at(Math.min(1, t + 0.004)));
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        if (len > 0) {
          if (Math.abs(dx) > 0.2 * len) facing = dx < 0 ? -1 : 1;
          const deg = Math.atan2(dy, Math.abs(dx)) * 180 / Math.PI;
          tilt = Math.max(-cfg.maxTilt, Math.min(cfg.maxTilt, deg));
        }
        if (trail) liveLeg = trail(t);
        if (elapsed >= duration) {
          timer.stop();
          pos = at(1);
          if (trail) { legs.push(trail(1)); liveLeg = []; }
          perch();
          resolve();
        } else {
          render();
        }
      });
    });
  }

  // Fly along a path given in screen coordinates (for the title and the close-up).
  // Assumes the camera holds still during the flight.
  const flyScreenPath = (at, duration) => flyAlong(t => MapView.fromScreen(at(t)), duration);

  function placeAt(p) { pos = p.slice(); render(); }
  function placeAtScreen(p) { placeAt(MapView.fromScreen(p)); }
  const screenPos = () => MapView.toScreen(pos);
  function show() { g.style("display", null); }
  function hide() { g.style("display", "none"); }
  function clearTrail() { legs = []; liveLeg = []; trailPath.classed("finale", false); render(); }

  // Finale: the dots flow along the trail that's showing.
  function highlightTrail(on) { trailPath.classed("finale", on); }

  return {
    init, placeAt, placeAtScreen, screenPos, flyTo, flyScreenPath,
    perch, show, hide, clearTrail, highlightTrail,
  };
})();
