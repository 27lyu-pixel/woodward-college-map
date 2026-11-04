// HTML layer for the student card and the finale totals, laid over the map and scaled to
// the same 1920x1080 stage. It's kept outside the SVG on purpose: Safari doesn't scale
// HTML placed inside an SVG, which made the card huge and cut off.
const UI = (() => {
  const W = 1920, H = 1080;
  const el = document.getElementById("ui");

  // Match the SVG's "fit and center" (viewBox + meet) exactly.
  function fit() {
    const s = Math.min(innerWidth / W, innerHeight / H);
    el.style.transform = `translate(${(innerWidth - W * s) / 2}px, ${(innerHeight - H * s) / 2}px) scale(${s})`;
  }
  addEventListener("resize", fit);
  fit();

  return { layer: () => d3.select(el) };
})();
