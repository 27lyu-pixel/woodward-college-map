// Loads the sheet CSV, picks the current rotation, and finds each college on the map.
//
// Published columns: Rotation start | Student name | College | City | State | Status | Photo |
// Scholarship total | Acceptances total | Commitments total (the last two typed by the
// counselors on the Class totals tab; the finale uses them instead of counting rows). The counselors type on a private Students tab that also has each
// student's Scholarship amount; the sheet's "TV feed" tab copies it without the amounts and
// adds "Scholarship total" (the sum, in its first row). Only the TV feed tab is published.
// - Status is "Accepted" or "Committed" (blank = CONFIG.categories.default).
// - Photo is optional: the student's yearbook photo (Google Drive link or a file in assets/photos/).
//   Left blank, the student gets the photo in assets/photos/ that has their name (listed in
//   assets/photos/index.json by tools/import_photos.py).
// - City and State are optional: they're filled in from the matched college. They're only
//   needed to tell apart same-named colleges, or to place a college that isn't in the list.
// - The current rotation is the latest "Rotation start" on or before today (or, with
//   CONFIG.rotation.paused, every row dated on or before today).
// - A blank "Rotation start" means "same as the row above".
// - Rows play in sheet order, except (see CONFIG.order and playOrder below): a Georgia
//   college never plays first, and two students at the same college never play back to back.
// Colleges are matched against data/colleges.json (IPEDS) plus data/college-extras.json.
// Problems never stop the show: they are collected in `flags` (console + debug panel).
const Data = (() => {
  const STATES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
    CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
    HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
    KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
    MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
    NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
    NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
    OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
    TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
    WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
  };
  const CACHE_KEY = "wa-slideshow-last-csv";
  let loadedText = null;   // the sheet as it was when the page loaded

  // "The University of Texas at Austin" -> "university of texas at austin"
  const norm = s => (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/^the /, "");

  // ---------- college index ----------

  let index;  // normalized name -> [{ college, priority }]  (0 exact, 1 alias, 2 name without campus)

  function addKey(key, college, priority) {
    const k = norm(key);
    if (!k) return;
    const list = index.get(k) || [];
    if (!list.some(c => c.college === college)) list.push({ college, priority });
    index.set(k, list);
  }

  function buildIndex(ipeds, extras) {
    index = new Map();
    const byName = new Map();
    const f = Object.fromEntries(ipeds.fields.map((name, i) => [name, i]));
    for (const r of ipeds.rows) {
      const c = { name: r[f.name], city: r[f.city], state: r[f.state], lat: r[f.lat], lon: r[f.lon], size: r[f.size],
                  web: r[f.web] || "", logoFile: r[f.logo] || "" };
      byName.set(c.name, c);
      addKey(c.name, c, 0);
      r[f.aliases].split("|").forEach(a => addKey(a, c, 1));
      // "University of Michigan-Ann Arbor" is also findable as "University of Michigan".
      const dash = c.name.lastIndexOf("-");
      if (dash > 0 && c.name.slice(0, dash).trim().includes(" ")) addKey(c.name.slice(0, dash), c, 2);
    }
    for (const [name, x] of Object.entries(extras.colleges)) {
      let c = byName.get(name);
      if (!c && x.lat != null && x.lon != null) {
        c = { name, city: x.city || "", state: x.state || "", lat: x.lat, lon: x.lon, size: 0, web: "", logoFile: "" };
        addKey(name, c, 0);
      }
      if (!c) { console.warn(`college-extras.json: "${name}" is not in colleges.json and has no lat/lon`); continue; }
      c.color = x.color;
      if (x.logo) c.logo = x.logo;   // hand-picked logo: beats anything looked up
      if (x.web) c.web = x.web;
      (x.aliases || []).forEach(a => addKey(a, c, 1));
    }
  }

  function findCollege(name, city, state) {
    let cands = index.get(norm(name)) || [];
    if (cands.length > 1 && state) {
      const s = cands.filter(c => c.college.state === state);
      if (s.length) cands = s;
    }
    if (cands.length > 1 && city) {
      const c = cands.filter(c => norm(c.college.city) === norm(city));
      if (c.length) cands = c;
    }
    cands = cands.slice().sort((a, b) => a.priority - b.priority || b.college.size - a.college.size);
    return cands.length ? cands[0].college : null;
  }

  // ---------- dates ----------

  function parseDate(s) {
    s = (s || "").trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return new Date(+m[1], m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) {
      const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      return new Date(y, m[1] - 1, +m[2]);
    }
    const d = new Date(s);
    return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // Today at midnight, or ?today=YYYY-MM-DD for testing.
  function today() {
    const param = new URLSearchParams(location.search).get("today");
    const d = param ? parseDate(param) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const fmt = d => d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "none";

  // ---------- CSV ----------

  async function fetchCsv(flags, url = CONFIG.data.csvUrl, cacheKey = CACHE_KEY, what = "the sheet") {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // A trial sheet (?csv=) never replaces the saved copy of the real one.
      if (!CONFIG.data.trial) try { localStorage.setItem(cacheKey, text); } catch (e) {}
      return text;
    } catch (err) {
      let cached = null;
      try { cached = localStorage.getItem(cacheKey); } catch (e) {}
      if (!cached) throw new Error(`Could not load ${what} (${url}): ${err.message}`);
      flags.push({ row: null, message: `Could not load ${what} (${err.message}); using the last copy that loaded.` });
      return cached;
    }
  }

  // Map header names to our fields, tolerating case and extra spaces.
  function columns(headers) {
    const find = (...words) => headers.find(h => words.every(w => norm(h).includes(w)));
    return {
      date: find("rotation") || find("date"),
      student: find("student") || find("name"),
      college: find("college") || find("school"),
      city: find("city"),
      state: find("state"),
      status: find("status") || find("category") || find("type"),
      // Amounts per student should never be published; only to warn if they are.
      scholarship: headers.find(h => /scholar|award/.test(norm(h)) && !norm(h).includes("total")),
      scholarshipTotal: find("scholar", "total"),
      // Class totals the counselors type on the sheet's Class totals tab (blank = count the rows).
      acceptancesTotal: find("acceptances", "total"),
      commitmentsTotal: find("commitments", "total"),
      photo: find("photo") || find("picture") || find("image"),
    };
  }

  // "Doe, Jane" / "JANE DOE.jpg" -> "doe jane": the same key as sheet/match-photos.gs.
  const nameKey = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter(Boolean).sort().join(" ");

  // name key -> file in assets/photos/, from assets/photos/index.json
  function photoIndex(files) {
    const index = new Map();
    for (const f of Array.isArray(files) ? files : []) index.set(nameKey(f.replace(/\.[^.]+$/, "")), f);
    return index;
  }

  // Photo cell -> image URL. Google Drive share links become Drive's image link; other web
  // links are used as is; anything else is a file name in assets/photos/.
  function photoUrl(text) {
    const t = (text || "").trim();
    if (!t) return "";
    const drive = /drive\.google\.com/.test(t) && t.match(/\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})/);
    if (drive) return `https://drive.google.com/thumbnail?id=${drive[1] || drive[2]}&sz=w1000`;
    if (/^https?:\/\//i.test(t)) return t;
    return "assets/photos/" + t.split("/").map(encodeURIComponent).join("/");
  }

  // "$120,000", "120000", "$120k", "1.5M" -> dollars; blank/"none" -> 0; else null.
  function parseMoney(text) {
    const t = (text || "").replace(/[$,\s]/g, "").toLowerCase();
    if (!t || /^(none|n\/?a|-+|0+(\.0+)?)$/.test(t)) return 0;
    const m = t.match(/^(\d+(?:\.\d+)?)(k|m)?/);
    if (!m) return null;
    return Math.round(+m[1] * (m[2] === "m" ? 1e6 : m[2] === "k" ? 1e3 : 1));
  }

  // "Committed", "commit", "Accepted", "admitted", ... -> "committed" | "accepted" | null
  function parseStatus(text) {
    const t = norm(text);
    if (!t) return CONFIG.categories.default;
    if (/^(commit|enroll|deposit|decided|attend)/.test(t)) return "committed";
    if (/^(accept|admit|in$)/.test(t)) return "accepted";
    return null;
  }

  // ---------- main ----------

  async function load() {
    const flags = [];
    const [text, ipeds, extras, photoList] = await Promise.all([
      fetchCsv(flags),
      d3.json("data/colleges.json"),
      d3.json("data/college-extras.json"),
      d3.json("assets/photos/index.json").catch(() => []),
    ]);
    const photoFiles = photoIndex(photoList);
    buildIndex(ipeds, extras);

    loadedText = text;
    const raw = d3.csvParse(text);
    const col = columns(raw.columns);
    for (const [field, header] of Object.entries(col)) {
      if (!header && !["city", "status", "scholarship", "scholarshipTotal", "acceptancesTotal", "commitmentsTotal", "photo"].includes(field)) flags.push({ row: null, message: `No "${field}" column found in the sheet.` });
    }
    if (col.scholarship) flags.push({ row: null, message: `The published sheet has each student's "${col.scholarship}" amount, so anyone with the link can see it. Publish the "TV feed" tab instead of Students.` });

    // The year's scholarship total: the first filled cell of the "Scholarship total" column.
    // Typed class totals: the first filled cell of each column, or null to count the rows.
    const classTotals = {};
    for (const [key, field] of [["accepted", "acceptancesTotal"], ["committed", "commitmentsTotal"]]) {
      const cell = col[field] ? raw.map(r => (r[col[field]] || "").trim()).find(Boolean) : undefined;
      const n = cell ? Number(cell.replace(/[,\s]/g, "")) : NaN;
      classTotals[key] = cell && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
      if (cell && classTotals[key] === null) flags.push({ row: null, message: `Can't read the class total "${cell}" (type a whole number).` });
    }

    let scholarships = null;
    if (col.scholarshipTotal) {
      const cell = raw.map(r => (r[col.scholarshipTotal] || "").trim()).find(Boolean);
      scholarships = parseMoney(cell);
      if (cell && scholarships === null) flags.push({ row: null, message: `Can't read the scholarship total "${cell}".` });
    }

    let lastDate = null;
    const rows = [], broken = [];
    raw.forEach((r, i) => {
      const row = i + 2;  // sheet row number (row 1 is the header)
      // A formula error (#REF!, #N/A, ...) means the sheet's formulas broke, e.g. after rows were
      // deleted on an old-style TV feed tab. Skip the row; one flag below explains it.
      if (Object.values(r).some(v => /^#(REF!|N\/A|VALUE!|ERROR!|NAME\?)/.test((v || "").trim()))) { broken.push(row); return; }
      const get = k => (col[k] ? (r[col[k]] || "").trim() : "");
      const student = get("student"), college = get("college");
      if (!student && !college) return;   // blank line
      const dateText = get("date");
      const date = dateText ? parseDate(dateText) : lastDate;
      if (dateText && !date) flags.push({ row, message: `Can't read the date "${dateText}".` });
      if (date) lastDate = date;
      let status = parseStatus(get("status"));
      if (!status) {
        status = CONFIG.categories.default;
        flags.push({ row, message: `Status "${get("status")}" isn't Accepted or Committed; showing it as ${CONFIG.categories[status].label}.` });
      }
      rows.push({ row, date, student, college, city: get("city"), state: get("state").toUpperCase(), status,
                  photo: photoUrl(get("photo") || photoFiles.get(nameKey(student)) || "") });
    });

    const now = today();
    const past = rows.filter(r => r.date && r.date <= now);
    const rotation = past.length ? new Date(Math.max(...past.map(r => +r.date))) : null;
    if (!rotation) flags.push({ row: null, message: `No rotation starts on or before ${fmt(now)}.` });

    // Resolve every row up to today (batch and season); report problems once per row.
    for (const r of past) {
      if (!r.student) { r.skip = "missing student name"; }
      else if (!r.college) { r.skip = "missing college"; }
      else {
        const c = findCollege(r.college, r.city, r.state);
        if (c) {
          Object.assign(r, { lat: c.lat, lon: c.lon, color: c.color, matched: c.name, collegeState: c.state,
                             logo: c.logo, logoFile: c.logoFile, web: c.web });
          // City and State are optional in the sheet: fill them in from the college list.
          if (!r.city) r.city = c.city;
          if (!r.state) r.state = c.state;
        } else if (STATES[r.state] && MapView.stateLonLat(STATES[r.state])) {
          const [lon, lat] = MapView.stateLonLat(STATES[r.state]);
          Object.assign(r, { lat, lon, matched: `(center of ${STATES[r.state]})`, collegeState: r.state });
          r.warn = `College "${r.college}" not found; placed at the center of ${STATES[r.state]}.`;
        } else {
          r.skip = `College "${r.college}" not found. Pick it from the College list, or fill in City and State.`;
        }
        if (!r.skip && !MapView.project(r.lon, r.lat)) r.skip = `"${r.college}" is outside the US map.`;
      }
      const inBatch = CONFIG.rotation.paused || +r.date === +rotation;
      if (!r.skip && !r.photo && photoFiles.size && CONFIG.card.photos.enabled) r.warn = r.warn || `No photo: name a photo "${r.student}.jpg" in assets/photos/ or fill in the Photo cell.`;
      if (r.skip) flags.push({ row: r.row, message: `${r.student || "(no name)"}: ${r.skip} Not shown.`, inBatch });
      else if (r.warn) flags.push({ row: r.row, message: `${r.student}: ${r.warn}`, inBatch });
    }

    if (broken.length) flags.push({ row: null, message: `${broken.length} row${broken.length === 1 ? "" : "s"} of the published sheet show formula errors like #REF! (rows ${broken.join(", ")}), so they're skipped. This happens when rows are deleted on the Students tab; replace the TV feed tab's formulas as described in the README ("TV feed shows #REF!").` });
    flags.forEach(f => console.warn(`[slideshow] ${f.row ? `Row ${f.row}: ` : ""}${f.message}`));

    const playable = r => !r.skip;
    return {
      today: now,
      rotation,
      label: { today: fmt(now), rotation: CONFIG.rotation.paused ? `everyone so far (weekly cycle paused; latest group ${fmt(rotation)})` : fmt(rotation) },
      // Every row of the current rotation, incl. skipped; everyone so far while the cycle is paused.
      batch: CONFIG.rotation.paused ? past : past.filter(r => +r.date === +rotation),
      season: past,                                     // every rotation up to today
      playable,
      scholarships,   // total dollars offered (whole year), or null
      classTotals,    // { accepted, committed }: typed on the Class totals tab, or null each
      flags,
    };
  }

  // Play order: sheet order, nudged just enough to follow CONFIG.order.
  // With spreadSameStudent, a student's colleges are spread out first: everyone's first
  // college (in sheet order), then everyone's second, and so on. Then each slot takes the earliest remaining row that (a) isn't in `notFirstState` when it's the
  // first slot, (b) isn't the same college or student as the row before, and (c) still leaves the rest
  // arrangeable without back-to-back repeats. If a rule can't be met (e.g. every college is in
  // Georgia, or most students go to one college), it's relaxed rather than dropping anyone;
  // "not first" wins over "no repeats" when the two conflict.
  function playOrder(rows) {
    const { notFirstState, spreadSameCollege, spreadSameStudent } = CONFIG.order;
    const key = r => r.matched || norm(r.college);
    const who = r => norm(r.student);
    const state = r => (r.collegeState || r.state || "").toUpperCase();

    // Can `rest` be laid out with no two of a college in a row, not starting with `prev`?
    const canSpread = (rest, prev) => {
      const counts = new Map();
      rest.forEach(r => counts.set(key(r), (counts.get(key(r)) || 0) + 1));
      const m = rest.length, max = Math.max(0, ...counts.values());
      if (max > Math.ceil(m / 2)) return false;
      return !(m % 2 && max === (m + 1) / 2 && counts.get(prev) === max);
    };

    let left = rows.slice();
    if (spreadSameStudent) {
      const count = new Map();
      left = left.map((r, i) => { const k = count.get(who(r)) || 0; count.set(who(r), k + 1); return { r, k, i }; })
        .sort((a, b) => a.k - b.k || a.i - b.i).map(x => x.r);
    }
    const out = [];
    while (left.length) {
      const prev = out.length ? key(out[out.length - 1]) : null;
      const ok = (r, i, strictFirst) => {
        if (strictFirst && !out.length && notFirstState && state(r) === notFirstState) return false;
        if (spreadSameStudent && out.length && who(r) === who(out[out.length - 1])) return false;
        if (!spreadSameCollege) return true;
        return key(r) !== prev && canSpread(left.filter((_, j) => j !== i), key(r));
      };
      let i = left.findIndex((r, i) => ok(r, i, true));
      // "Not first" beats "no repeats": start out of state even if a repeat follows later.
      if (i < 0 && !out.length && notFirstState) i = left.findIndex(r => state(r) !== notFirstState);
      if (i < 0) i = left.findIndex((r, i) => ok(r, i, false));               // all in Georgia
      if (i < 0 && spreadSameCollege) i = left.findIndex(r => key(r) !== prev); // repeat unavoidable later
      if (i < 0) i = 0;                                                        // repeat unavoidable now
      out.push(left.splice(i, 1)[0]);
    }
    return out;
  }

  // Has the published sheet changed since the page loaded? False if it can't be reached.
  async function sheetChanged() {
    try {
      const res = await fetch(CONFIG.data.csvUrl, { cache: "no-store" });
      return res.ok && (await res.text()) !== loadedText;
    } catch (e) {
      return false;
    }
  }

  const stateName = abbr => STATES[(abbr || "").toUpperCase()] || null;

  return { load, norm, playOrder, stateName, sheetChanged };
})();
