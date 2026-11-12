// The slim bar at the top of the screen, on the whole loop: days until graduation
// (CONFIG.graduation), then the commitments and acceptances, the year's scholarship total from
// the sheet (if any), and students, colleges and states, for the current rotation ("batch") or
// every rotation so far ("season"), set by CONFIG.totals.scope (CONFIG.totals.bar).
const Totals = (() => {
  let bar;
  const MAX_WIDTH = 1840;   // stage px (the screen is 1920 wide)
  const LABELS = {
    students: ["Student", "Students"],
    colleges: ["College", "Colleges"],
    states: ["State", "States"],
  };

  function init() {
    bar = UI.layer().append("div").attr("class", "statbar");
  }

  const dollars = d3.format("$,.0f");

  // Counts only rows that made it onto the map.
  function totals(rows) {
    const shown = rows.filter(r => !r.skip);
    // A college that fell back to a state center counts by the name typed in the sheet.
    const collegeKey = r => r.warn ? "sheet:" + Data.norm(r.college) : r.matched;
    return {
      // One student can have several acceptances, so count each name once.
      students: new Set(shown.map(r => Data.norm(r.student))).size,
      colleges: new Set(shown.map(collegeKey)).size,
      states: new Set(shown.map(r => r.collegeState).filter(Boolean)).size,
      committed: shown.filter(r => r.status === "committed").length,
      accepted: shown.filter(r => r.status !== "committed").length,
    };
  }

  // The numbers the bar shows.
  function numbers(data) {
    // While the weekly cycle is paused, everyone so far is playing: count them all.
    const scope = CONFIG.totals.scope === "season" || CONFIG.rotation.paused ? "season" : "batch";
    const counts = totals(scope === "season" ? data.season : data.batch);
    // Class totals typed on the sheet replace the counted commitments and acceptances.
    for (const key of ["committed", "accepted"]) {
      if (data.classTotals && data.classTotals[key] != null) counts[key] = data.classTotals[key];
    }
    return { scope, counts, money: data.scholarships || 0 };
  }

  // "177 days until graduation · May 8", worked out once per load (the page reloads every
  // day). Null after graduation day or with no date set.
  function countdown() {
    const cfg = CONFIG.graduation;
    if (!cfg || !cfg.date) return null;
    const [y, m, d] = cfg.date.split("-").map(Number);
    const grad = new Date(y, m - 1, d);
    const days = Math.round((grad - Data.today()) / 86400000);   // both at midnight
    if (days < 0) return null;
    if (days === 0) return `<b>${cfg.todayLabel}</b>`;
    const when = grad.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<b>${days.toLocaleString("en-US")}</b> ${days === 1 ? "day" : "days"} ${cfg.label}<span class="bar-date"> · ${when}</span>`;
  }

  // Fill the bar once per load.
  function setBar(data) {
    const { scope, counts, money } = numbers(data);
    const n = (k, labels) => `<b>${counts[k].toLocaleString("en-US")}</b> ${labels[counts[k] === 1 ? 0 : 1]}`;
    const showTotals = CONFIG.totals.bar && counts.students;
    const items = showTotals ? [
      `<span class="bar-pin committed"></span>${n("committed", CONFIG.categories.committed.total)}`,
      `<span class="bar-pin accepted"></span>${n("accepted", CONFIG.categories.accepted.total)}`,
      ...(money ? [`<b>${dollars(money)}</b> ${CONFIG.totals.barScholarshipLabel}`] : []),
      n("students", LABELS.students), n("colleges", LABELS.colleges), n("states", LABELS.states),
    ] : [];
    const grad = countdown();
    bar.classed("off", !grad && !items.length);
    bar.html((grad ? `<span class="bar-item bar-countdown">${grad}</span>` : "") +
             (items.length ? `<span class="bar-title">${CONFIG.totals.titles[scope]}</span>` : "") +
             items.map(i => `<span class="bar-item">${i}</span>`).join(""));
    // Keep it on screen: drop the "This season so far" label, then the date, if it's too wide.
    const fits = () => bar.node().offsetWidth <= MAX_WIDTH;
    bar.classed("tight", false).classed("tighter", false);
    if (!fits()) bar.classed("tight", true);
    if (!fits()) bar.classed("tighter", true);
  }

  return { init, totals, setBar };
})();
