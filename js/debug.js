// Debug panel: which rotation is playing, how each row matched, and any problems.
// Hidden on the TV. Open with ?debug=1 in the URL, or press D to toggle.
const Debug = (() => {
  let panel;

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function render(data) {
    const rows = data.batch.map(r => `
      <tr class="${r.skip ? "bad" : r.warn ? "warn" : ""}">
        <td>${r.row}</td><td>${esc(r.student)}</td><td>${esc(r.college)}</td>
        <td>${esc(CONFIG.categories[r.status]?.label || r.status)}</td>
        <td>${r.skip ? "Not shown" : esc(r.matched)}</td>
        <td>${r.color ? `<span class="swatch" style="background:${esc(r.color)}"></span>${esc(r.color)}` : "default"}</td>
      </tr>`).join("");
    const flags = data.flags.length
      ? `<ul>${data.flags.map(f => `<li>${f.row ? `Row ${f.row}: ` : ""}${esc(f.message)}${f.inBatch === false ? " <em>(earlier rotation)</em>" : ""}</li>`).join("")}</ul>`
      : "<p>No problems found.</p>";
    panel.innerHTML = `
      <h2>Slideshow data <small>press D to close</small></h2>
      <p>Today: <b>${data.label.today}</b> &middot; Playing rotation: <b>${data.label.rotation}</b>
         &middot; ${data.batch.filter(data.playable).length} of ${data.batch.length} rows shown
         &middot; Sheet: <code>${esc(CONFIG.data.csvUrl)}</code></p>
      <table><tr><th>Row</th><th>Student</th><th>College (sheet)</th><th>Status</th><th>Matched to</th><th>Color</th></tr>${rows}</table>
      <h3>Flags</h3>${flags}
      <p class="hint">Test another date: add <code>?debug=1&amp;today=2026-11-20</code> to the URL.</p>`;
  }

  function init(data) {
    panel = document.createElement("div");
    panel.className = "debug-panel";
    document.body.appendChild(panel);
    render(data);
    panel.hidden = !new URLSearchParams(location.search).has("debug");
    document.addEventListener("keydown", e => {
      if (e.key === "d" || e.key === "D") panel.hidden = !panel.hidden;
    });
  }

  return { init };
})();
