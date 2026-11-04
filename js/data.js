// Loads the sheet CSV, picks the current rotation, and finds each college on the map.
//
// Sheet columns: Rotation start | Student name | College | City | State | Status
// - Status is "Accepted" or "Committed" (blank = CONFIG.categories.default).
// - City and State are optional: they're filled in from the matched college. They're only
//   needed to tell apart same-named colleges, or to place a college that isn't in the list.
// - The current rotation is the latest "Rotation start" on or before today.
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

  async function fetchCsv(flags) {
    const url = CONFIG.data.csvUrl;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // A trial sheet (?csv=) never replaces the saved copy of the real one.
      if (!CONFIG.data.trial) try { localStorage.setItem(CACHE_KEY, text); } catch (e) {}
      return text;
    } catch (err) {
      let cached = null;
      try { cached = localStorage.getItem(CACHE_KEY); } catch (e) {}
      if (!cached) throw new Error(`Could not load the sheet (${url}): ${err.message}`);
      flags.push({ row: null, message: `Could not load the sheet (${err.message}); using the last copy that loaded.` });
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
    };
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
    const [text, ipeds, extras] = await Promise.all([
      fetchCsv(flags),
      d3.json("data/colleges.json"),
      d3.json("data/college-extras.json"),
    ]);
    buildIndex(ipeds, extras);

    const raw = d3.csvParse(text);
    const col = columns(raw.columns);
    for (const [field, header] of Object.entries(col)) {
      if (!header && field !== "city" && field !== "status") flags.push({ row: null, message: `No "${field}" column found in the sheet.` });
    }

    let lastDate = null;
    const rows = [];
    raw.forEach((r, i) => {
      const row = i + 2;  // sheet row number (row 1 is the header)
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
      rows.push({ row, date, student, college, city: get("city"), state: get("state").toUpperCase(), status });
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
      const inBatch = +r.date === +rotation;
      if (r.skip) flags.push({ row: r.row, message: `${r.student || "(no name)"}: ${r.skip} Not shown.`, inBatch });
      else if (r.warn) flags.push({ row: r.row, message: `${r.student}: ${r.warn}`, inBatch });
    }

    flags.forEach(f => console.warn(`[slideshow] ${f.row ? `Row ${f.row}: ` : ""}${f.message}`));

    const playable = r => !r.skip;
    return {
      today: now,
      rotation,
      label: { today: fmt(now), rotation: fmt(rotation) },
      batch: past.filter(r => +r.date === +rotation),   // every row of the current rotation, incl. skipped
      season: past,                                     // every rotation up to today
      playable,
      flags,
    };
  }

  // Play order: sheet order, nudged just enough to follow CONFIG.order.
  // Each slot takes the earliest remaining row that (a) isn't in `notFirstState` when it's the
  // first slot, (b) isn't the same college as the row before, and (c) still leaves the rest
  // arrangeable without back-to-back repeats. If a rule can't be met (e.g. every college is in
  // Georgia, or most students go to one college), it's relaxed rather than dropping anyone;
  // "not first" wins over "no repeats" when the two conflict.
  function playOrder(rows) {
    const { notFirstState, spreadSameCollege } = CONFIG.order;
    const key = r => r.matched || norm(r.college);
    const state = r => (r.collegeState || r.state || "").toUpperCase();

    // Can `rest` be laid out with no two of a college in a row, not starting with `prev`?
    const canSpread = (rest, prev) => {
      const counts = new Map();
      rest.forEach(r => counts.set(key(r), (counts.get(key(r)) || 0) + 1));
      const m = rest.length, max = Math.max(0, ...counts.values());
      if (max > Math.ceil(m / 2)) return false;
      return !(m % 2 && max === (m + 1) / 2 && counts.get(prev) === max);
    };

    const left = rows.slice(), out = [];
    while (left.length) {
      const prev = out.length ? key(out[out.length - 1]) : null;
      const ok = (r, i, strictFirst) => {
        if (strictFirst && !out.length && notFirstState && state(r) === notFirstState) return false;
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

  const stateName = abbr => STATES[(abbr || "").toUpperCase()] || null;

  return { load, norm, playOrder, stateName };
})();
