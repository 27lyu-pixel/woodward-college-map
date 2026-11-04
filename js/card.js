// Student card: slides in from the side of the screen away from the college,
// so it never covers the pin Eddy just landed on. HTML in the stage-sized UI layer
// (js/ui.js), so it scales with the TV and long names can wrap.
const Card = (() => {
  let card;
  const SLIDE_IN_MS = 650, SLIDE_OUT_MS = 450;   // keep in sync with .card transitions in style.css
  const logos = new Map();   // college -> Promise<url | null>

  function init(svgEl) {
    card = UI.layer().append("div").attr("class", "card left").html(`
      <div class="card-bar"></div>
      <div class="card-body">
        <div class="card-tag"></div>
        <div class="card-student"></div>
        <div class="card-kicker">is headed to</div>
        <div class="card-college"></div>
        <div class="card-place"></div>
      </div>
      <div class="card-logo"><img alt=""><div class="card-monogram"></div></div>`);
  }

  // ---------- college logos ----------
  // Tried in order: a logo picked by hand in college-extras.json, the college's logo or seal
  // from Wikipedia, then the icon from its own website (only if it's big enough to look
  // sharp). If none loads, the card shows the college's initials in its color instead.
  function candidates(s) {
    const cfg = CONFIG.card.logos, list = [];
    if (s.logo) list.push({ url: s.logo, min: 1 });
    if (s.logoFile) list.push({ url: `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(s.logoFile)}?width=600`, min: 1 });
    if (cfg.websiteIcons && s.web) list.push({ url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(s.web)}&sz=256`, min: cfg.minIconPx });
    return list;
  }

  function tryImage({ url, min }) {
    return new Promise(resolve => {
      const img = new Image();
      const done = ok => { clearTimeout(timer); resolve(ok ? url : null); };
      const timer = setTimeout(() => done(false), 10000);
      img.onload = () => done(img.naturalWidth >= min);
      img.onerror = () => done(false);
      img.src = url;
    });
  }

  function logoFor(s) {
    const key = s.matched || s.college;
    if (!logos.has(key)) {
      logos.set(key, (async () => {
        if (!CONFIG.card.logos.enabled) return null;
        for (const c of candidates(s)) { const url = await tryImage(c); if (url) return url; }
        return null;
      })());
    }
    return logos.get(key);
  }

  // Start fetching every logo up front so they're ready when the cards come up.
  function preload(students) { students.forEach(logoFor); }

  // "University of Michigan" -> "UM", "Georgia Tech" -> "GT"
  const initials = name => name.replace(/&/g, " ").split(/[\s\-–,]+/)
    .filter(w => w && !/^(of|the|at|and|in|for|de)$/i.test(w)).map(w => w[0].toUpperCase()).join("").slice(0, 3);

  async function setLogo(s) {
    const box = card.select(".card-logo");
    box.classed("has-img", false).classed("ready", false);
    card.select(".card-monogram").text(initials(s.college)).style("background", s.color || null);
    const url = await Promise.race([logoFor(s), new Promise(r => setTimeout(() => r(undefined), 1500))]);
    if (url) {
      box.select("img").attr("src", url);
      box.classed("has-img", true);
    }
    box.classed("ready", true);
  }

  // student: { student, college, city, state, color, logo... }; side: "left" | "right"
  async function show(student, side) {
    const status = CONFIG.categories[student.status] ? student.status : CONFIG.categories.default;
    const cat = CONFIG.categories[status];
    card.attr("data-status", status);
    card.select(".card-tag").text(cat.label);
    card.select(".card-kicker").text(cat.kicker);
    card.select(".card-student").text(student.student);
    card.select(".card-college").text(student.college);
    card.select(".card-place").text([student.city, student.state].filter(Boolean).join(", "));
    card.select(".card-bar").style("background", student.color || null);
    await setLogo(student);

    // Jump to the hidden spot on the chosen side without animating, then slide in.
    const node = card.node();
    node.style.transition = "none";
    card.classed("in", false).classed("left", side === "left").classed("right", side === "right");
    void node.offsetWidth;
    node.style.transition = "";
    card.classed("in", true);
    return new Promise(r => setTimeout(r, SLIDE_IN_MS));
  }

  function hide() {
    card.classed("in", false);
    return new Promise(r => setTimeout(r, SLIDE_OUT_MS));
  }

  return { init, show, hide, preload, logoFor };
})();
