// Totals bar: a slim bar at the top of the screen with the commitments and acceptances, the
// year's scholarship total from the sheet (if any), and students, colleges and states, for the
// current rotation ("batch") or every rotation so far ("season"), set by CONFIG.totals.scope.
// It's on screen the whole loop except the Congratulations screen (CONFIG.totals.bar).
const Totals = (() => {
  let bar;
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

  // Fill the bar once per load.
  function setBar(data) {
    const { scope, counts, money } = numbers(data);
    if (!CONFIG.totals.bar || !counts.students) { bar.classed("off", true); return; }
    const n = (k, labels) => `<b>${counts[k].toLocaleString("en-US")}</b> ${labels[counts[k] === 1 ? 0 : 1]}`;
    const items = [
      `<span class="bar-pin committed"></span>${n("committed", CONFIG.categories.committed.total)}`,
      `<span class="bar-pin accepted"></span>${n("accepted", CONFIG.categories.accepted.total)}`,
      ...(money ? [`<b>${dollars(money)}</b> ${CONFIG.totals.barScholarshipLabel}`] : []),
      n("students", LABELS.students), n("colleges", LABELS.colleges), n("states", LABELS.states),
    ];
    bar.html(`<span class="bar-title">${CONFIG.totals.titles[scope]}</span>` +
             items.map(i => `<span class="bar-item">${i}</span>`).join(""));
  }

  // Out of the way while the Congratulations screen is up.
  function away(on) { bar.classed("away", on); }

  return { init, totals, setBar, away };
})();
