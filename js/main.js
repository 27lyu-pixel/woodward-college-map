// The full loop: title -> home base -> one flight per student -> finale -> title ...
// Keys: R reloads, D toggles the debug panel.
const wait = ms => new Promise(r => setTimeout(r, ms));
const t = CONFIG.timing;
const loadedOn = new Date().toDateString();
let lastCheck = Date.now();
let home, data, students;

document.addEventListener("keydown", e => {
  if (e.key === "r" || e.key === "R") location.reload();
});

// Quadratic curve through screen points a -> b, bending toward c.
const quad = (a, c, b) => s => [0, 1].map(i => (1 - s) ** 2 * a[i] + 2 * (1 - s) * s * c[i] + s * s * b[i]);

// 1. Title: Eddy flies onto the words and perches.
async function playTitle(first) {
  const from = first ? [-160, 300] : Eddy.screenPos();   // after a loop he flies up from Woodward
  await Promise.all([Title.show(), Finale.hide(), Card.hide()]);

  // Hidden behind the title: reset the map to the close-up.
  Eddy.clearTrail();
  MapView.clearDestinations();
  MapView.showCloseup();
  Eddy.placeAtScreen(from);
  Eddy.show();

  const perch = Title.perchPoint();
  const lift = [(from[0] + perch[0]) / 2, Math.min(from[1], perch[1]) - 220];
  await Eddy.flyScreenPath(quad(from, lift, perch), t.titleFlyInMs);
  await wait(t.titlePerchMs);
}

// 2. Home base: the title fades into the College Park close-up while Eddy circles
//    Woodward once and lands; then the map zooms out to the US.
async function playHomeBase() {
  const start = Title.perchPoint();
  const pin = MapView.toScreen(home);
  const c = [pin[0], pin[1] - 90], r = 210;
  const a0 = Math.atan2(start[1] - c[1], start[0] - c[0]);
  const onCircle = a => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  const entry = onCircle(a0);
  const approach = quad(start, [(start[0] + entry[0]) / 2, Math.min(start[1], entry[1]) - 120], entry);
  const landing = quad(entry, [entry[0], pin[1] - 160], pin);
  // Approach 0-25%, one full circle 25-80%, land 80-100%.
  const path = s =>
    s < 0.25 ? approach(s / 0.25) :
    s < 0.8 ? onCircle(a0 - 2 * Math.PI * (s - 0.25) / 0.55) :
    landing((s - 0.8) / 0.2);

  Title.hide();
  await Eddy.flyScreenPath(path, t.homeCircleMs);
  await MapView.zoomOutToUS(t.zoomMs);
}

// Near Woodward = would land on top of it at full-US scale.
const isLocal = s => d3.geoDistance([s.lon, s.lat], [CONFIG.woodward.lon, CONFIG.woodward.lat]) * 6371
  <= CONFIG.map.local.radiusKm;

// 3. One flight per student, in play order (Data.playOrder). Same college twice in a row
//    (only when it can't be avoided) = short hop.
//    Eddy flies at full-US scale; after he lands, the camera zooms into the college's state
//    (lit up, with its name). Colleges near Woodward use a zoomed Atlanta-area view instead.
let view = null;   // what the camera is zoomed into: null (whole US), "metro", or a state name

async function zoomOut() {
  if (!view) return;
  MapView.highlightState(null);
  await MapView.zoomOutToUS(view === "metro" ? t.localZoomMs : t.stateZoomOutMs);
  view = null;
}

async function playStudents() {
  const nearby = students.filter(isLocal).map(s => MapView.project(s.lon, s.lat));
  const metro = MapView.fitView([home, ...nearby], CONFIG.map.local);
  let prev = null, eddyNearby = true;   // he starts at Woodward
  view = null;
  for (const s of students) {
    const dest = MapView.project(s.lon, s.lat);
    const local = isLocal(s);
    const hop = prev && prev.lat === s.lat && prev.lon === s.lon;
    const state = CONFIG.map.state.enabled ? Data.stateName(s.collegeState || s.state) : null;
    const side = state && MapView.stateSide(state);
    const target = local ? { key: "metro", view: metro }
      : state ? { key: state, view: MapView.stateView(state, side) } : { key: null };
    if (!hop) MapView.addDestination(s.lon, s.lat, s.color, s.status);
    Card.hide();   // slides out while he takes off

    // Leaving the current state (or the Atlanta area): zoom back out to the whole US first.
    if (!hop && view && view !== target.key) await zoomOut();
    // A short trip around Atlanta is flown zoomed in.
    if (target.key === "metro" && view !== "metro" && eddyNearby) {
      await MapView.flyTo(metro, t.localZoomMs);
      view = "metro";
    }
    await Eddy.flyTo(dest, hop ? t.hopMs : t.flightMs);
    // Landed: zoom into his state (or the Atlanta area).
    if (target.key && target.view && view !== target.key) {
      if (target.key !== "metro") MapView.highlightState(target.key);
      await MapView.flyTo(target.view, target.key === "metro" ? t.localZoomMs : t.stateZoomInMs);
      view = target.key;
    }
    eddyNearby = local;
    await wait(t.landBeatMs);
    const cardSide = view && view !== "metro" ? side : MapView.toScreen(dest)[0] > 960 ? "left" : "right";
    await Card.show(s, cardSide);
    await wait(t.cardHoldMs);
    prev = s;
  }
}

// 4. Finale: back out to the whole US, fly home while the map makes room, then the trail
//    (his last CONFIG.eddy.maxTrails flights) and totals.
async function playFinale() {
  Card.hide();
  await zoomOut();
  await Promise.all([Eddy.flyTo(home, t.flightMs), MapView.moveToFinale(t.flightMs)]);
  Eddy.highlightTrail(true);
  MapView.celebrate(true);
  if (students.length) Finale.show(data);
  await wait(t.finaleHoldMs);
}

async function loadData() {
  try {
    return await Data.load();
  } catch (err) {
    // No sheet and no saved copy: keep the title and home base running, retry soon.
    console.error(err);
    setTimeout(() => location.reload(), CONFIG.refresh.retryMinutes * 60000);
    const label = { today: new Date().toDateString(), rotation: "none" };
    return { batch: [], season: [], playable: () => true, flags: [{ row: null, message: err.message }], label };
  }
}

(async () => {
  await document.fonts.ready;   // the title is measured to place Eddy's perch
  const stage = document.getElementById("stage");
  await MapView.init(stage);
  Title.init();
  Eddy.init();
  Card.init(stage);
  Finale.init(stage);
  data = await loadData();
  Debug.init(data);
  students = Data.playOrder(data.batch.filter(data.playable));
  Card.preload(students);
  home = MapView.project(CONFIG.woodward.lon, CONFIG.woodward.lat);

  for (let first = true; ; first = false) {
    // Between loops, so a student is never cut off: reload on a new day (a new rotation may
    // start), or when the sheet has changed (checked every CONFIG.refresh.checkMinutes).
    if (new Date().toDateString() !== loadedOn) { location.reload(); return; }
    if (Date.now() - lastCheck >= CONFIG.refresh.checkMinutes * 60000) {
      lastCheck = Date.now();
      if (await Data.sheetChanged()) { location.reload(); return; }
    }
    await playTitle(first);
    await playHomeBase();
    await playStudents();
    await playFinale();
  }
})();
