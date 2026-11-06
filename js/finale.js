// Finale totals panel: students, colleges and states, plus commitments and acceptances, for
// the current rotation ("batch") or every rotation so far ("season"), set by
// CONFIG.totals.scope. Next to them, the year's scholarship total from the sheet, if any.
// The same numbers stay on a slim bar at the top of the screen the rest of the time
// (CONFIG.totals.bar), since many viewers walk by before the finale.
const Finale = (() => {
  let panel, bar;
  const SLIDE_MS = 600, COUNT_MS = 1100;   // keep SLIDE_MS in sync with .totals in style.css
  const LABELS = {
    students: ["Student", "Students"],
    colleges: ["College", "Colleges"],
    states: ["State", "States"],
  };

  function init(svgEl) {
    panel = UI.layer().append("div").attr("class", "totals").html(`
      <div class="totals-title"></div>
      <div class="totals-stats">
        ${Object.keys(LABELS).map(k => `
          <div class="stat" data-key="${k}">
            <div class="stat-num">0</div>
            <div class="stat-label"></div>
          </div>`).join("")}
      </div>
      <div class="totals-cats">
        ${["committed", "accepted"].map(k => `
          <div class="cat ${k}" data-key="${k}">
            <span class="cat-pin"></span><span class="cat-num">0</span> <span class="cat-label"></span>
          </div>`).join("")}
        <div class="cat money"><span class="money-num">$0</span> <span class="money-label"></span></div>
      </div>`);
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

  // The numbers both the panel and the bar show.
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

  // Slim always-on bar: fill it once per load; it shows except while the finale panel is up.
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

  function show(data) {
    const { scope, counts, money } = numbers(data);
    bar.classed("away", true);
    panel.select(".money").classed("hidden", !money);
    panel.select(".money-label").text(CONFIG.totals.scholarshipLabel);
    panel.select(".money-num").text(dollars(0));
    panel.select(".totals-title").text(CONFIG.totals.titles[scope]);
    for (const [key, n] of Object.entries(counts)) {
      const plural = n === 1 ? 0 : 1;
      if (LABELS[key]) {
        const stat = panel.select(`.stat[data-key="${key}"]`);
        stat.select(".stat-label").text(LABELS[key][plural]);
      } else {
        panel.select(`.cat[data-key="${key}"] .cat-label`).text(CONFIG.categories[key].total[plural]);
      }
      panel.selectAll(`[data-key="${key}"] .stat-num, [data-key="${key}"] .cat-num`).text(0);
    }
    panel.classed("in", true);

    // Count each number up from 0 once the panel has slid in.
    setTimeout(() => {
      const timer = d3.timer(elapsed => {
        const t = d3.easeCubicOut(Math.min(1, elapsed / COUNT_MS));
        for (const [key, n] of Object.entries(counts)) {
          panel.selectAll(`[data-key="${key}"] .stat-num, [data-key="${key}"] .cat-num`).text(Math.round(n * t));
        }
        panel.select(".money-num").text(dollars(money * t));
        if (t >= 1) timer.stop();
      });
    }, SLIDE_MS * 0.6);

    return new Promise(r => setTimeout(r, SLIDE_MS));
  }

  function hide() {
    panel.classed("in", false);
    bar.classed("away", false);
    return new Promise(r => setTimeout(r, SLIDE_MS));
  }

  return { init, show, hide, totals, setBar };
})();
