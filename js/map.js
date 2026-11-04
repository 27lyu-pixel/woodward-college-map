// Map rendering and camera. The map is drawn once in stage coordinates
// (full-US view) and the camera moves by transforming the "world" group.
const MapView = (() => {
  const W = 1920, H = 1080;
  let world, counties, overlay, projection, statesByName, geoPath, statePaths, stateLabel;
  // Overlay items that follow a map point: { node, x, y, show }
  // show: "closeup" (fades out when zooming out), "far" (fades in), or "always".
  let markers = [];
  let current = [W / 2, H / 2, W];   // camera view: [centerX, centerY, visibleWidth]
  let camera = { k: 1, tx: 0, ty: 0 };
  const cameraListeners = [];
  const layers = {};  // screen-space layers for other modules: trails (under pins), actors (on top)

  async function init(svgEl) {
    const [us, ga] = await Promise.all([
      d3.json("data/us-states.json"),
      d3.json("data/ga-counties.json"),
    ]);
    const nation = topojson.feature(us, us.objects.nation);
    const states = topojson.feature(us, us.objects.states);
    statesByName = new Map(states.features.map(f => [f.properties.name, f]));

    projection = d3.geoAlbersUsa().fitExtent([[90, 90], [W - 90, H - 90]], nation);
    const path = geoPath = d3.geoPath(projection);
    const svg = d3.select(svgEl);

    world = svg.append("g").attr("class", "world");
    statePaths = world.append("g").attr("class", "states")
      .selectAll("path").data(states.features).join("path").attr("d", path);
    counties = world.append("g").attr("class", "counties");
    counties.selectAll("path").data(ga.features).join("path").attr("d", path);
    world.append("path").attr("class", "state-borders")
      .datum(topojson.mesh(us, us.objects.states, (a, b) => a !== b)).attr("d", path);
    world.append("path").attr("class", "nation").datum(nation).attr("d", path);

    layers.trails = svg.append("g").attr("class", "trails");
    overlay = svg.append("g").attr("class", "overlay");
    layers.title = svg.append("g").attr("class", "title");   // covers the map; Eddy flies above it
    layers.actors = svg.append("g").attr("class", "actors");
    CONFIG.map.closeupLabels.forEach(addPlaceLabel);
    addWoodwardPin();
    // Name of the state Eddy just flew to, shown above it while zoomed in.
    const g = overlay.append("g").attr("class", "state-name");
    stateLabel = { text: g.append("text").attr("text-anchor", "middle").attr("y", -18), marker: null };
    stateLabel.marker = { node: g, x: 0, y: 0, show: "always" };
    markers.push(stateLabel.marker);

    showCloseup();
  }

  // Map position for a lon/lat, or null if it falls outside the US map.
  function project(lon, lat) {
    return projection([lon, lat]);
  }

  // [lon, lat] of a state's center (by full name), or null.
  function stateLonLat(name) {
    const f = statesByName.get(name);
    return f ? d3.geoCentroid(f) : null;
  }

  function addMarker(g, lon, lat, show) {
    const [x, y] = project(lon, lat);
    const m = { node: g, x, y, show };
    markers.push(m);
    return m;
  }

  // A college pin. Committed = solid dot in the college color; accepted = hollow ring.
  // Returns its map position (stage coords at the US view).
  function addDestination(lon, lat, color, status = "accepted") {
    const committed = status === "committed";
    const g = overlay.append("g").attr("class", `destination ${status}`);
    g.append("circle").attr("class", "dest-ring").attr("r", committed ? 14 : 10)
      .style("animation-delay", `${(markers.filter(m => m.destination).length % 6) * 0.25}s`);
    g.append("circle").attr("class", "dest-dot").attr("r", committed ? 14 : 9)
      .style(committed ? "fill" : "stroke", color || null);
    // White star so a committed pin reads as committed even when its color is close to the map's.
    if (committed) g.append("path").attr("class", "dest-star").attr("d", d3.symbol(d3.symbolStar, 120)());
    const m = addMarker(g, lon, lat, "always");
    m.destination = true;
    apply(current);
    return [m.x, m.y];
  }

  function clearDestinations() {
    markers.filter(m => m.destination).forEach(m => m.node.remove());
    markers = markers.filter(m => !m.destination);
  }

  // Map position -> current screen position.
  function toScreen([x, y]) {
    return [camera.tx + x * camera.k, camera.ty + y * camera.k];
  }

  // Screen position -> map position under the current camera.
  function fromScreen([sx, sy]) {
    return [(sx - camera.tx) / camera.k, (sy - camera.ty) / camera.k];
  }

  function onCamera(fn) { cameraListeners.push(fn); }

  function addPlaceLabel(p) {
    const g = overlay.append("g");
    g.append("circle").attr("class", "place-dot").attr("r", p.type === "city" ? 6 : 4);
    const pos = { right: [14, 10, "start"], left: [-14, 10, "end"], below: [0, 40, "middle"] };
    const [x, y, anchor] = pos[p.side] || pos.right;
    g.append("text").attr("class", `place-label ${p.type}`)
      .attr("x", x).attr("y", y).attr("text-anchor", anchor).text(p.name);
    addMarker(g, p.lon, p.lat, "closeup");
  }

  function addWoodwardPin() {
    const w = CONFIG.woodward;

    // Logo card beside the pin (close-up only). Logo is 200x57 at its native size.
    const logoW = 340, logoH = logoW * 57 / 200, pad = 26;
    const cardW = logoW + pad * 2, cardH = logoH + pad * 2;
    const card = overlay.append("g").attr("class", "logo-card");
    const cx = 48, cy = -36 - cardH / 2;   // left edge of card, vertically centered on the pin head
    card.append("path").attr("class", "logo-card-bg")
      .attr("d", `M${cx},${cy + 12} a12,12 0 0 1 12,-12 h${cardW - 24} a12,12 0 0 1 12,12
                  v${cardH - 24} a12,12 0 0 1 -12,12 h-${cardW - 24} a12,12 0 0 1 -12,-12
                  V${-36 + 14} l-16,-14 l16,-14 Z`);
    card.append("image").attr("href", "assets/woodward-logo.svg")
      .attr("x", cx + pad).attr("y", cy + pad).attr("width", logoW).attr("height", logoH);
    addMarker(card, w.lon, w.lat, "closeup");

    const g = overlay.append("g").attr("class", "pin");
    g.append("ellipse").attr("class", "pin-pulse").attr("rx", 22).attr("ry", 9);
    g.append("path").attr("class", "pin-body")
      .attr("d", "M0,0 C-5,-12 -18,-22 -18,-36 A18,18 0 1,1 18,-36 C18,-22 5,-12 0,0 Z");
    g.append("circle").attr("class", "pin-eye").attr("cy", -36).attr("r", 7);
    addMarker(g, w.lon, w.lat, "always");

    // Text label takes over from the logo card once zoomed out. It sits under the pin,
    // where Eddy (standing on top of the pin) never covers it.
    const label = overlay.append("g");
    label.append("text").attr("class", "pin-label").attr("text-anchor", "middle").attr("y", 34).text(w.name);
    addMarker(label, w.lon, w.lat, "far");
  }

  // Close-up view centered on Woodward.
  function closeupView() {
    const [x, y] = project(CONFIG.woodward.lon, CONFIG.woodward.lat);
    return [x, y, W / CONFIG.map.closeupZoom];
  }

  const usView = () => [W / 2, H / 2, W];

  function apply(view) {
    current = view;
    const k = W / view[2];
    const tx = W / 2 - view[0] * k;
    const ty = H / 2 - view[1] * k;
    camera = { k, tx, ty };
    world.attr("transform", `translate(${tx},${ty}) scale(${k})`);

    // 1 at the close-up, 0 once zoomed out to `minK`.
    // 0 at zoom `from`, 1 at zoom `to` (log scale, clamped).
    const ramp = (from, to) => Math.max(0, Math.min(1, Math.log(k / from) / Math.log(to / from)));
    const cz = CONFIG.map.closeupZoom;
    counties.style("opacity", ramp(4, cz));
    // Close-up labels and the logo card leave early so they never pile up, and are gone
    // before the Atlanta-area view; the plain "Woodward Academy" label then takes over.
    const labelOpacity = ramp(cz * 0.7, cz);
    const farOpacity = ramp(cz * 0.7, cz * 0.62);

    for (const m of markers) {
      m.node.attr("transform", `translate(${tx + m.x * k},${ty + m.y * k})`);
      if (m.show === "closeup") m.node.style("opacity", labelOpacity);
      if (m.show === "far") m.node.style("opacity", farOpacity);
    }
    cameraListeners.forEach(fn => fn());
  }

  // US map shrunk and lifted to leave room for the totals panel at the bottom.
  function finaleView() {
    const { scale: k, lift } = CONFIG.map.finale;
    return [W / 2, H / 2 + lift / k, W / k];
  }

  function showCloseup() { highlightState(null); apply(closeupView()); celebrate(false); }

  // A view that fits a state (full name) in the half of the screen away from the student
  // card: side "left" = card on the left, so the state sits in the right half.
  function stateView(name, side) {
    const f = statesByName.get(name);
    if (!f) return null;
    const cfg = CONFIG.map.state;
    const [[x0, y0], [x1, y1]] = geoPath.bounds(f);
    const region = side === "left" ? [1080, 160, 1860, 1010] : [60, 160, 840, 1010];   // stage px
    const rw = region[2] - region[0], rh = region[3] - region[1];
    const k = Math.max(1, Math.min(cfg.maxZoom, rw / (x1 - x0), rh / (y1 - y0)));
    const rx = (region[0] + region[2]) / 2, ry = (region[1] + region[3]) / 2;
    const cx = (x0 + x1) / 2 - (rx - W / 2) / k, cy = (y0 + y1) / 2 - (ry - H / 2) / k;
    return [cx, cy, W / k];
  }

  // Which side the card goes on for a state: away from where the state is on the US map.
  function stateSide(name) {
    const f = statesByName.get(name);
    return f && geoPath.centroid(f)[0] > W / 2 ? "left" : "right";
  }

  // Lighten the destination state and show its name above it (null clears).
  function highlightState(name) {
    statePaths.classed("dest-state", d => d.properties.name === name);
    const f = name && statesByName.get(name);
    stateLabel.marker.node.classed("on", !!f);
    if (f) {
      const [[x0, y0], [x1]] = geoPath.bounds(f);
      Object.assign(stateLabel.marker, { x: (x0 + x1) / 2, y: y0 });
      stateLabel.text.text(name.toUpperCase());
      apply(current);
    }
  }
  function showUS() { apply(usView()); }

  // Finale: college pins pulse.
  function celebrate(on) { overlay.classed("celebrate", on); }

  // Smooth camera move between two views (van Wijk zoom). Resolves when done.
  function flyTo(target, duration) {
    const interp = d3.interpolateZoom(current, target);
    return new Promise(resolve => {
      const timer = d3.timer(elapsed => {
        const t = Math.min(1, elapsed / duration);
        apply(interp(d3.easeCubicInOut(t)));
        if (t >= 1) { timer.stop(); resolve(); }
      });
    });
  }

  // A view that fits the given map positions with some room around them,
  // zoomed in no further than `maxZoom` (used for colleges near Woodward).
  function fitView(points, { maxZoom, padding }) {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const [x0, x1] = d3.extent(xs), [y0, y1] = d3.extent(ys);
    const width = Math.max((x1 - x0) * padding, (y1 - y0) * padding * W / H, W / maxZoom);
    return [(x0 + x1) / 2, (y0 + y1) / 2, width];
  }

  const zoomOutToUS = duration => flyTo(usView(), duration);
  const moveToFinale = duration => flyTo(finaleView(), duration);

  return {
    init, project, stateLonLat, toScreen, fromScreen, onCamera, layers,
    addDestination, clearDestinations, fitView, stateView, stateSide, highlightState,
    showCloseup, showUS, flyTo, zoomOutToUS, moveToFinale, celebrate,
  };
})();
