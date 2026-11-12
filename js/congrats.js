// End of each loop: a full-screen "Congratulations to the Class of 2027!" with red, white and
// black confetti. Eddy flies in and perches on the words, then flies back to the title.
// Sits above the title slide and under Eddy (MapView.layers.congrats).
const Congrats = (() => {
  let g, line1, confetti, timer = null, pieces = [];
  const FADE_MS = 900;
  const COLORS = ["#e8213b", "#c8102e", "#ffffff", "#ffffff", "#111111", "#111111"];
  const COUNT = 170;

  function init() {
    const cfg = CONFIG.congrats;
    g = MapView.layers.congrats.style("display", "none").style("opacity", 0);
    // Same look as the title slide: crimson glow, running past the stage for non-16:9 screens.
    const grad = g.append("defs").append("radialGradient").attr("id", "congrats-bg")
      .attr("gradientUnits", "userSpaceOnUse").attr("cx", 0).attr("cy", 0).attr("r", 1)
      .attr("gradientTransform", "translate(960,540) scale(960,540)");
    grad.append("stop").attr("offset", "0%").attr("class", "title-bg-center");
    grad.append("stop").attr("offset", "100%").attr("class", "title-bg-edge");
    g.append("rect").attr("x", -1920).attr("y", -1080).attr("width", 5760).attr("height", 3240)
      .attr("fill", "url(#congrats-bg)");

    // Confetti falls behind the words so they stay readable.
    confetti = g.append("g").attr("class", "confetti");

    const year = Title.classYear();
    g.append("text").attr("class", "title-kicker").attr("x", 960).attr("y", 370).text(cfg.kicker);
    g.append("line").attr("class", "title-rule").attr("x1", 860).attr("x2", 1060).attr("y1", 410).attr("y2", 410);
    line1 = g.append("text").attr("class", "title-line congrats-big").attr("x", 960).attr("y", 570)
      .text(cfg.lines[0].replace("{year}", year));
    g.append("text").attr("class", "title-line congrats-small").attr("x", 960).attr("y", 710)
      .text(cfg.lines[1].replace("{year}", year));
  }

  // Where Eddy stands: on top of the end of the first line (screen coords).
  function perchPoint() {
    const b = line1.node().getBBox();
    return [b.x + b.width - 90, b.y + b.height * 0.22];
  }

  // One strip of confetti, starting above the screen (or anywhere above it on the first burst).
  function spawn(p, spread) {
    p.x = -200 + Math.random() * 2320;
    p.y = -40 - Math.random() * spread;
    p.vy = 160 + Math.random() * 220;           // px per second
    p.sway = 30 + Math.random() * 70;           // side-to-side drift
    p.swaySpeed = 1 + Math.random() * 2.5;
    p.phase = Math.random() * Math.PI * 2;
    p.rot = Math.random() * 360;
    p.spin = (Math.random() - 0.5) * 540;       // degrees per second
    p.flip = 3 + Math.random() * 6;             // tumbling: how fast it turns edge-on
    return p;
  }

  function startConfetti() {
    stopConfetti();
    pieces = d3.range(COUNT).map(() => spawn({}, 1100));
    const els = confetti.selectAll("rect").data(pieces).join("rect")
      .attr("x", d => -(d.w = 14 + Math.random() * 12) / 2)
      .attr("y", d => -(d.h = 8 + Math.random() * 10) / 2)
      .attr("width", d => d.w).attr("height", d => d.h).attr("rx", 2)
      .attr("fill", (_, i) => COLORS[i % COLORS.length]);
    let last = 0;
    timer = d3.timer(elapsed => {
      const dt = Math.min(0.05, (elapsed - last) / 1000), s = elapsed / 1000;
      last = elapsed;
      for (const p of pieces) {
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        if (p.y > 1140) spawn(p, 200);
      }
      els.attr("transform", p => {
        const x = p.x + Math.sin(s * p.swaySpeed + p.phase) * p.sway;
        return `translate(${x},${p.y}) rotate(${p.rot}) scale(1,${Math.cos(s * p.flip + p.phase).toFixed(3)})`;
      });
    });
  }

  function stopConfetti() {
    if (timer) timer.stop();
    timer = null;
  }

  function fade(to) {
    if (to) g.style("display", null);
    return new Promise(resolve => {
      g.transition().duration(FADE_MS).style("opacity", to).on("end", () => {
        if (!to) { g.style("display", "none"); stopConfetti(); }
        resolve();
      });
    });
  }

  function show() { startConfetti(); return fade(1); }

  return { init, perchPoint, show, hide: () => fade(0) };
})();
