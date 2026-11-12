// Title slide: covers the map, sits under Eddy so he can perch on the words.
const Title = (() => {
  let g, line1;
  const FADE_MS = 900;

  // Seniors in the fall of 2026 are the Class of 2027.
  function classYear() {
    const now = new Date();
    return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  }

  function init() {
    const cfg = CONFIG.title;
    g = MapView.layers.title.style("display", "none").style("opacity", 0);
    // Gradient is laid out on the 1920x1080 stage (same look as before), but the rect
    // runs well past it so non-16:9 screens don't show the map in the side/top bands.
    const grad = g.append("defs").append("radialGradient").attr("id", "title-bg")
      .attr("gradientUnits", "userSpaceOnUse").attr("cx", 0).attr("cy", 0).attr("r", 1)
      .attr("gradientTransform", "translate(960,540) scale(960,540)");
    grad.append("stop").attr("offset", "0%").attr("class", "title-bg-center");
    grad.append("stop").attr("offset", "100%").attr("class", "title-bg-edge");
    g.append("rect").attr("x", -1920).attr("y", -1080).attr("width", 5760).attr("height", 3240)
      .attr("fill", "url(#title-bg)");

    g.append("text").attr("class", "title-kicker").attr("x", 960).attr("y", 370)
      .text(cfg.kicker.replace("{year}", classYear()));
    line1 = g.append("text").attr("class", "title-line").attr("x", 960).attr("y", 545).text(cfg.lines[0]);
    g.append("text").attr("class", "title-line").attr("x", 960).attr("y", 690).text(cfg.lines[1]);
    g.append("line").attr("class", "title-rule").attr("x1", 860).attr("x2", 1060).attr("y1", 410).attr("y2", 410);
  }

  // Where Eddy stands: on top of the last word of the first line (screen coords).
  function perchPoint() {
    const b = line1.node().getBBox();
    return [b.x + b.width - 70, b.y + b.height * 0.22];
  }

  function fade(to) {
    if (to) g.style("display", null);
    return new Promise(resolve => {
      g.transition().duration(FADE_MS).style("opacity", to).on("end", () => {
        if (!to) g.style("display", "none");
        resolve();
      });
    });
  }

  return { init, perchPoint, classYear, show: () => fade(1), hide: () => fade(0) };
})();
