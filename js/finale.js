// Finale totals panel: students, colleges and states, plus commitments, acceptances and the
// scholarship money offered (hidden when the sheet has none), for the current rotation
// ("batch") or every rotation so far ("season"), set by CONFIG.totals.scope.
const Finale = (() => {
  let panel;
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
      // Every offer counts, including colleges the student turned down.
      scholarships: d3.sum(shown, r => r.scholarship || 0),
    };
  }

  function show(data) {
    const scope = CONFIG.totals.scope === "season" ? "season" : "batch";
    const { scholarships: money, ...counts } = totals(scope === "season" ? data.season : data.batch);
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
    return new Promise(r => setTimeout(r, SLIDE_MS));
  }

  return { init, show, hide, totals };
})();
