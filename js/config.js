// All the knobs in one place. Colors live in css/style.css.
const CONFIG = {
  data: {
    // Google Sheet published as CSV (File > Share > Publish to web > Students tab > CSV).
    // The counselors' "College Acceptances" sheet. data/sample.csv has made-up test rows.
    // The scholarship total: the sheet's "Scholarship total" tab, published as CSV the same way
    // (only the sum is public; the amounts per student stay on the private Scholarships tab).
    // Leave "" to hide the scholarship line.
    totalsCsvUrl: "",
    csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRb-_kpbMWLq8QljbgNizmUALYyEn4TXruX4k23VzZt6uLVuh1CMALRnXUhKqyBZ_J-_FTY9fRJJry_/pub?output=csv",
  },

  title: {
    lines: ["Where are our senior", "War Eagles headed?"],
    kicker: "Woodward Academy · Class of {year}",   // {year} = this year's seniors
  },

  order: {
    // Students play in sheet order, adjusted so that:
    notFirstState: "GA",       // a college in this state never plays first ("" to turn off)
    spreadSameCollege: true,   // two students at the same college never play back to back
  },

  // The sheet's "Status" column. Each category gets its own wording on the card, tag
  // color and pin style, and is counted separately in the finale.
  categories: {
    default: "accepted",   // used when the Status cell is blank
    committed: { label: "Committed", kicker: "has committed to", total: ["Commitment", "Commitments"] },
    accepted:  { label: "Accepted",  kicker: "was accepted to",  total: ["Acceptance", "Acceptances"] },
  },

  card: {
    // Student photo on the left of the card, from the sheet's Photo column: a Google Drive
    // link (shared "Anyone with the link") or a file name in assets/photos/. Students
    // without one show their initials there. enabled: false removes the spot.
    photos: { enabled: true },
    // College logo on each student card. Found automatically (Wikipedia logo or seal, then
    // the college website's icon); pick one by hand with "logo" in data/college-extras.json.
    // Colleges with no logo show their initials in the college color.
    logos: {
      enabled: true,
      websiteIcons: true,   // fall back to the college website's icon
      minIconPx: 96,        // ...only if it's at least this big (small icons look blurry)
    },
  },

  totals: {
    // Finale totals: "batch" = current rotation only, "season" = every rotation so far.
    scope: "batch",
    titles: { batch: "This rotation", season: "This season so far" },
    // Next to the commitments: the sheet's scholarship total, for the whole year whatever the
    // scope above (hidden when it's blank or 0, or totalsCsvUrl isn't set).
    scholarshipLabel: "in scholarships offered this year",
  },

  woodward: {
    name: "Woodward Academy",
    lat: 33.6624,   // 1662 Rugby Ave, College Park, GA (OpenStreetMap)
    lon: -84.4400,
  },

  map: {
    // How far the close-up is zoomed in relative to the full-US view.
    // 80 shows roughly 65 km (40 mi) across the screen.
    closeupZoom: 80,
    // Labels shown only in the close-up; they fade out as the map zooms out.
    // side: where the text sits relative to its dot ("right", "left", "below").
    closeupLabels: [
      { name: "Atlanta",      lat: 33.7490, lon: -84.3880, type: "city",  side: "right" },
      { name: "College Park", lat: 33.6420, lon: -84.4780, type: "city",  side: "left" },
      { name: "Hartsfield-Jackson Airport", lat: 33.6407, lon: -84.4277, type: "place", side: "below" },
    ],
    // Colleges within `radiusKm` of Woodward get a zoomed Atlanta-area view, since at
    // full-US scale they'd land on top of Woodward. The view fits Woodward and every
    // nearby college in the rotation, zoomed in at most `maxZoom` (80 = the close-up).
    local: { radiusKm: 60, maxZoom: 45, padding: 1.8 },
    // After Eddy lands, zoom into the college's state (lit up, with its name), placed on the
    // side of the screen away from the student card. maxZoom keeps tiny states (RI, DE, DC)
    // from filling the screen. Set enabled: false to stay on the whole-US map.
    state: { enabled: true, maxZoom: 7 },
    // Finale camera: map shrinks to `scale` and moves up `lift` px to make room for the totals.
    finale: { scale: 0.84, lift: 110 },
  },

  eddy: {
    // Which Eddy artwork plays: "drawn" or "higgsfield". Try the other one without editing
    // by adding ?eddy=higgsfield (or ?eddy=drawn) to the page URL.
    art: "higgsfield",
    arts: {
      // Flat cartoon drawn in code (tools/draw_eddy.py, 240x200 SVG boxes).
      drawn: {
        frames: {
          fly: ["assets/eddy/fly-1.svg", "assets/eddy/fly-2.svg", "assets/eddy/fly-3.svg"],
          perch: "assets/eddy/perch.svg",
        },
        // Shirt logo spot per frame: [x, y, width, rotation°] (x, y, width as fractions of
        // the art box, x/y = logo center), or null to hide it on that frame.
        badgeSpots: {
          "fly-1": [0.442, 0.668, 0.092, -14],
          "fly-2": [0.442, 0.668, 0.092, -14],
          "fly-3": [0.355, 0.664, 0.079, -14],   // wing covers the front of the shirt
          "perch": [0.458, 0.58, 0.125, 0],
        },
      },
      // Generated with Higgsfield from the drawn poses + the mascot art, then fitted to the
      // same box shape by tools/fit_eddy_png.py (600x500 PNGs).
      higgsfield: {
        frames: {
          fly: ["assets/eddy-hf/fly-1.png", "assets/eddy-hf/fly-2.png", "assets/eddy-hf/fly-3.png"],
          perch: "assets/eddy-hf/perch.png",
        },
        // On his chest. Same spot on every wing frame so it doesn't flicker as he flaps
        // (the down-stroke wing limits how big it can be there).
        badgeSpots: {
          "fly-1": [0.587, 0.66, 0.073, -10],
          "fly-2": [0.587, 0.66, 0.073, -10],
          "fly-3": [0.587, 0.66, 0.073, -10],
          "perch": [0.509, 0.475, 0.117, 0],
        },
      },
    },
    // Both artworks use this box shape. Art faces right (east); any number of fly frames (2+).
    width: 200, height: 167,   // on-screen size (stage px); keep the art's aspect ratio
    feet: [0.492, 0.86],       // where his feet are in the art (fraction of width, height)
    pivot: [0.467, 0.62],      // point he tilts around (fraction of width, height)
    // Shirt logo, drawn on top of each frame and never mirrored, so "WA" reads correctly
    // when he flies west. Its spot on each frame is `badgeSpots` in the artwork above.
    // The logo is cut from the mascot artwork by tools/cut_wa_logo.py.
    badge: { src: "assets/eddy/wa.png", aspect: 1.012 },   // aspect = height / width of the logo
    flapFps: 10,
    maxTilt: 22,               // degrees he leans into climbs and dives
    arcBend: 0.25,             // how much flights bow north (fraction of distance)
    minArc: 110,               // curve height for very short flights and hops (stage px)
  },

  timing: {
    titleFlyInMs: 1600, // Eddy flies onto the title (title slide is ~5s in all)
    titlePerchMs: 2400, // Eddy perched on the title
    homeCircleMs: 2900, // title fades; Eddy circles Woodward once and lands
    zoomMs: 2200,       // College Park -> full US zoom
    flightMs: 2600,     // one flight between stops
    hopMs: 1200,        // short hop when two rows in a row share a college
    localZoomMs: 1300,  // zoom into / out of the Atlanta-area view
    stateZoomInMs: 1300,  // zoom into the college's state after landing
    stateZoomOutMs: 1000, // back out to the whole US before the next flight
    landBeatMs: 250,    // pause after landing before the card slides in
    cardHoldMs: 3000,   // student card fully visible
    finaleHoldMs: 3400, // totals on screen after Eddy lands home (finale = flightMs + this)
  },

  // Reload once the date changes (picks up a new rotation and sheet edits), checked
  // between loops so it never cuts off a student. Retry sooner if the sheet failed to load.
  refresh: { retryMinutes: 10 },
};

// URL options for testing: ?csv=<link> tries another sheet (e.g. a new sheet's published
// link) without editing this file, ?totals=<link> another scholarship total tab; ?eddy=... picks the Eddy artwork.
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("csv")) { CONFIG.data.csvUrl = params.get("csv"); CONFIG.data.trial = true; }
  if (params.get("totals")) { CONFIG.data.totalsCsvUrl = params.get("totals"); CONFIG.data.trial = true; }
  const e = CONFIG.eddy;
  const pick = params.get("eddy");
  e.art = e.arts[pick] ? pick : e.art;
  e.frames = e.arts[e.art].frames;
  e.badge.spots = e.arts[e.art].badgeSpots;
})();
