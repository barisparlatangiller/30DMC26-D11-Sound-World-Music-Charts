/* The Geography of Sound · #30DayMapChallenge 2026 · Day 11 · Sound */
const FAMC = { "Pop": "#ff5fa2", "Hip hop & rap": "#ffd23f", "Latin pop & urban": "#ff8a3d", "Regional Latin": "#e5383b", "Brazilian": "#2ee59d",
  "East Asian pop": "#8f7cff", "Afro & Caribbean": "#a3e635", "R&B & soul": "#e0b3ff", "Electronic & dance": "#22d3ee", "Rock & indie": "#5b8def",
  "Country": "#c99560", "Local & folk": "#f6bd60", "Unclassified": "#5b6275" };
const BASE = "#1d1a36", NODATA = "#141228", CC_FIX = { gb: "GB", global: "🌐" };
const $ = s => document.querySelector(s);
const pct = (x, d = 0) => (100 * x).toFixed(d) + "%";
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixc = (a, b, k) => { const A = hex(a), B2 = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B2[i] - v) * Math.max(0, Math.min(1, k)))).join(",")})`; };
const ramp = (stops, x) => { for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; return mixc(ca, cb, (x - a) / (b - a)); } return stops[stops.length - 1][1]; };
const flag = cc => cc === "global" ? "🌐" : cc.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const S = { view: "genre", plat: "both", cc: "global", genre: null, artist: 0, twin: "tr", spin: true };
window.S = S;

const HOME = [[0, BASE], [0.15, "#3b2a6b"], [0.4, "#8f3fb0"], [0.65, "#ff5fa2"], [0.9, "#ffd1e6"]];
const GAP = [[0.2, "#ff5fa2"], [0.38, "#9b4fd6"], [0.5, "#3b3a8f"], [0.62, "#2f86c9"], [0.75, "#7ef0ff"]];
const TWIN = [[0, BASE], [0.3, "#2c2a5c"], [0.55, "#3f5bd6"], [0.75, "#22d3ee"], [0.95, "#eafcff"]];
const RANKC = r => r === 1 ? "#fff3b0" : r <= 3 ? "#ffd23f" : r <= 10 ? "#ff8a3d" : r <= 50 ? "#ff5fa2" : "#6a4fd6";

async function load() {
  const j = u => fetch(u).then(r => r.json());
  [S.geo, S.M, S.A] = await Promise.all([j("data/countries.geojson?v=1"), j("data/music.json?v=1"), j("data/artists.json?v=1")]);
  S.F = S.M.families;
  S.M.countries.tr && (S.M.countries.tr.name_en = "Türkiye");
  const area = {}; for (const f of S.geo.features) { let a = 0; const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const P of polys) { const r = P[0]; for (let i = 1; i < r.length; i++) a += (r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1]); } area[f.properties.cc] = Math.abs(a); }
  S.order = Object.keys(S.M.labels).sort((a, b) => (area[b] || 0) - (area[a] || 0));
  S.ccIdx = Object.fromEntries(S.A.cc.map((c, i) => [c, i]));
  const top = S.M.facts.widest_reach[0][0]; S.artist = Math.max(0, S.A.artists.findIndex(a => a[0] === top));
}
const V = () => S.M.views[S.plat];
const cname = cc => S.M.countries[cc]?.name_en || cc.toUpperCase();

// ── map ──
let map;
function initMap() {
  map = S.map = new maplibregl.Map({ container: "map", center: [8, 32], zoom: 1.9, attributionControl: false, maxZoom: 6, renderWorldCopies: false,
    style: { version: 8, sources: { c: { type: "geojson", data: S.geo, promoteId: "cc" } }, layers: [
      { id: "bg", type: "background", paint: { "background-color": "rgba(0,0,0,0)" } },
      { id: "cf", type: "fill", source: "c", paint: { "fill-color": ["to-color", ["coalesce", ["feature-state", "col"], NODATA]], "fill-opacity": 0.95 } },
      { id: "cl", type: "line", source: "c", paint: { "line-color": ["case", ["boolean", ["feature-state", "sel"], false], "#ffffff", "rgba(255,255,255,0.14)"],
        "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 2, 0.5] } }] } });
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Charts: Zenodo 23645386 · genres: Wikidata · Natural Earth" }), "bottom-right");
  map.on("style.load", () => { try { map.setProjection({ type: "globe" }); } catch (e) {}
    try { map.setSky({ "sky-color": "#07060f", "horizon-color": "#3a2a78", "fog-color": "#07060f", "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 4, 0.6, 6, 0] }); } catch (e) {} });
  map.on("click", "cf", e => { const cc = e.features[0].properties.cc; if (!V()[cc] && !S.M.views.both[cc]) return; select(cc); });
  map.on("mousemove", "cf", e => { const cc = e.features[0].properties.cc; map.getCanvas().style.cursor = S.M.views.both[cc] ? "pointer" : ""; });
  map.on("move", () => S.ready && placeLabels());
  const stop = () => (S.spin = false);
  map.on("mousedown", stop); map.on("touchstart", stop); map.on("wheel", stop);
}

function select(cc) {
  if (S.view === "twins") S.twin = cc;
  S.cc = cc; paint(); card();
}

// colours per view
function colour(cc) {
  const v = V()[cc];
  if (S.view === "genre") {
    if (!v) return null;
    if (S.genre == null) { const g = v.genre.slice(0, -1), i = g.indexOf(Math.max(...g)), f = S.F[i]; return mixc(BASE, FAMC[f], 0.45 + 1.4 * g[i]); }
    const mx = Math.max(...Object.values(V()).map(x => x.genre[S.genre])); return mixc(BASE, FAMC[S.F[S.genre]], 0.08 + 0.92 * Math.sqrt(v.genre[S.genre] / (mx || 1)));
  }
  if (S.view === "home") return v ? ramp(HOME, v.home.home) : null;
  if (S.view === "artist") { const r = (S.A.reach[S.plat][S.artist] || []).find(x => S.A.cc[x[0]] === cc); return r ? RANKC(r[2]) : v ? BASE : null; }
  if (S.view === "gap") { const o = S.M.overlap[cc]; return o ? ramp(GAP, o.overlap) : null; }
  if (S.view === "twins") { const T = S.M.twins[S.plat], i = T.cc.indexOf(S.twin), j = T.cc.indexOf(cc); if (j < 0) return null; if (i < 0) return BASE;
    return cc === S.twin ? "#ffffff" : ramp(TWIN, T.sim[i][j]); }
}
function label(cc) {
  const v = V()[cc];
  if (S.view === "genre") { if (!v) return ""; if (S.genre != null) return v.genre[S.genre] > 0.005 ? `${pct(v.genre[S.genre])}` : "";
    return `${esc(v.number1)}<small>${esc(cname(cc))}</small>`; }
  if (S.view === "home") return v ? `${pct(v.home.home)}<small>${esc(cname(cc))}</small>` : "";
  if (S.view === "artist") { const r = (S.A.reach[S.plat][S.artist] || []).find(x => S.A.cc[x[0]] === cc); return r ? `#${r[2]}` : ""; }
  if (S.view === "gap") { const o = S.M.overlap[cc]; return o ? `${pct(o.overlap)}` : ""; }
  if (S.view === "twins") { const T = S.M.twins[S.plat], i = T.cc.indexOf(S.twin), j = T.cc.indexOf(cc); if (i < 0 || j < 0) return "";
    return cc === S.twin ? `${esc(cname(cc))}` : `${T.sim[i][j].toFixed(2)}`; }
}
const markers = {};
const toRGB = c => c[0] === "#" ? hex(c) : c.match(/\d+/g).slice(0, 3).map(Number);
function paint() {                                                   // S.prev + S.fadeK (0..1): cross-fade from the previous colours
  S.cols = {};
  for (const f of S.geo.features) {
    const cc = f.properties.cc; let c = colour(cc) || NODATA;
    if (S.prev && S.fadeK != null && S.fadeK < 1) { const a = toRGB(S.prev[cc] || NODATA), b = toRGB(c), k = S.fadeK * S.fadeK * (3 - 2 * S.fadeK);
      c = `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`; }
    S.cols[cc] = c;
    map.setFeatureState({ source: "c", id: cc }, { col: c, sel: cc === S.cc && !S.manual });
  }
  for (const [cc, ll] of Object.entries(S.M.labels)) {
    const html = label(cc);
    if (!markers[cc]) { const el = document.createElement("div"); el.className = "lbl"; markers[cc] = new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map); }
    markers[cc].getElement().innerHTML = html; markers[cc].dataset = html;
  }
  placeLabels(); legend();
}
// labels: hide those on the far side of the globe, then drop overlapping ones (bigger countries first)
function placeLabels() {
  const c = map.getCenter(), rad = Math.PI / 180, kept = [];
  const cx = Math.cos(c.lat * rad) * Math.cos(c.lng * rad), cy = Math.cos(c.lat * rad) * Math.sin(c.lng * rad), cz = Math.sin(c.lat * rad);
  for (const cc of S.order) {
    const m = markers[cc]; if (!m) continue; const el = m.getElement(), [lo, la] = S.M.labels[cc];
    const dot = Math.cos(la * rad) * Math.cos(lo * rad) * cx + Math.cos(la * rad) * Math.sin(lo * rad) * cy + Math.sin(la * rad) * cz;
    let show = !!el.innerHTML && dot > 0.18;
    if (show) { const p = map.project([lo, la]), fs = parseFloat(getComputedStyle(el).fontSize) || 11, h = fs * 2.3;
      const w = Math.max(...el.innerHTML.replace(/<small>/, "\n").replace(/<[^>]+>/g, "").split("\n").map(t => t.length)) * fs * 0.6;
      if (kept.some(q => Math.abs(q.x - p.x) < (w + q.w) / 2 + 4 && Math.abs(q.y - p.y) < h)) show = false; else kept.push({ x: p.x, y: p.y, w }); }
    el.style.opacity = show ? 1 : 0;
  }
}

function legend() {
  const f = S.M.facts; let h = "", note = "";
  if (S.view === "genre") {
    h = `<div class="chips">${S.F.slice(0, -1).map((g, i) => `<button class="chip ${S.genre === i ? "on" : ""}" data-g="${i}"><i class="dot" style="background:${FAMC[g]}"></i>${g}</button>`).join("")}</div>`;
    note = S.genre == null ? `Colour: the genre family with the most chart points in each country (brighter = more dominant). Labels: the country's #1 artist of 2026. Tap a genre to map its share. Genres come from Wikidata and are known for ${Math.round(100 * Object.values(S.M.genre_coverage).reduce((a, b) => a + b, 0) / Object.values(S.M.genre_coverage).length)}% of chart points on average (from ${Math.round(100 * Math.min(...Object.values(S.M.genre_coverage)))}% to ${Math.round(100 * Math.max(...Object.values(S.M.genre_coverage)))}% by country); many local artists have no genre there yet.`
      : `Share of all chart points that go to ${S.F[S.genre]} artists. Tap it again to go back.`;
  } else if (S.view === "home") {
    h = `<div class="ramp" style="background:linear-gradient(90deg,${HOME.map(s => s[1]).join(",")})"></div><div class="ends"><span>mostly imported</span><span>mostly home-grown</span></div>`;
    note = `Share of chart points going to artists from the country itself. Most home-grown: ${f.most_homegrown.slice(0, 3).map(x => `${x[0]} ${pct(x[1])}`).join(", ")}. Most US music: ${f.most_us.slice(0, 3).map(x => `${x[0]} ${pct(x[1])}`).join(", ")}.`;
  } else if (S.view === "artist") {
    const a = S.A.artists[S.artist];
    h = `<div class="chips">${[[1, "#1"], [3, "top 3"], [10, "top 10"], [50, "top 50"], [999, "charted"]].map(([r, t]) => `<span class="chip"><i class="dot" style="background:${RANKC(r)}"></i>${t}</span>`).join("")}</div>`;
    note = `<b style="color:#fff">${esc(a[0])}</b> · ${S.F[a[1]]}${a[2] ? " · from " + esc(cname(a[2])) : ""}${a[3] ? ` <span style="opacity:.75">(Wikidata: ${esc(a[3].split("; ").slice(0, 5).join(", "))})</span>` : ""}. Rank among all artists in each country's 2026 charts. Widest reach (top 10 in most countries): ${f.widest_reach.slice(0, 4).map(x => `${x[0]} (${x[1]})`).join(", ")}.`;
  } else if (S.view === "gap") {
    h = `<div class="ramp" style="background:linear-gradient(90deg,${GAP.map(s => s[1]).join(",")})"></div><div class="ends"><span>different worlds</span><span>the same charts</span></div>`;
    note = `How much the Spotify and YouTube charts of a country share the same artists (overlap of artist shares). Most different: ${f.platform_gap.filter(x => x[0] !== "Global").slice(0, 3).map(x => `${x[0]} ${pct(x[1])}`).join(", ")}. Most alike: ${f.platform_alike.slice(-3).reverse().map(x => `${x[0]} ${pct(x[1])}`).join(", ")}.`;
  } else {
    h = `<div class="ramp" style="background:linear-gradient(90deg,${TWIN.map(s => s[1]).join(",")})"></div><div class="ends"><span>different taste</span><span>musical twin</span></div>`;
    note = `Similarity of each country's charts to <b style="color:#fff">${esc(cname(S.twin))}</b> (tap any country). Closest pairs: ${f.twins.slice(0, 4).map(x => `${x[0]}–${x[1]} ${x[2]}`).join(", ")}.`;
  }
  $("#legend").innerHTML = h; $("#vnote").innerHTML = note;
  document.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { const g = +b.dataset.g; S.genre = S.genre === g ? null : g; paint(); });
}

// ── country card ──
function card() {
  const cc = S.cc, v = V()[cc];
  const cov = S.M.coverage.platforms;
  const wk = ["spotify", "youtube"].filter(p => cov[p][cc]).map(p => `${p === "spotify" ? "Spotify" : "YouTube"} ${cov[p][cc].weeks} weeks`).join(" · ");
  if (!v) { $("#card").innerHTML = `<div class="flag">${flag(cc)}</div><h2>${esc(cname(cc))}</h2><div class="sub">${wk || "no chart"}</div>
    <p class="fine" style="margin-top:12px">No ${S.plat === "both" ? "" : S.plat === "spotify" ? "Spotify " : "YouTube "}chart for this country in the archive. Try another platform.</p>`; return; }
  const g = v.genre, h = v.home;
  const twins = (() => { const T = S.M.twins[S.plat], i = T.cc.indexOf(cc); if (i < 0) return "";
    return T.cc.map((c, j) => [c, T.sim[i][j]]).filter(x => x[0] !== cc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => `${flag(x[0])} ${esc(cname(x[0]))} <b style="color:#fff">${x[1].toFixed(2)}</b>`).join(" · "); })();
  const ov = S.M.overlap[cc];
  $("#card").innerHTML = `<div class="flag">${flag(cc)}</div><h2>${esc(cname(cc))}</h2><div class="sub">${wk} · ${v.n_artists.toLocaleString("en-US")} artists charted · ${esc(S.M.countries[cc]?.lang || "")}</div>
    <div class="n1"><div class="eb">#1 artist of 2026 · ${S.plat === "both" ? "Spotify + YouTube" : S.plat === "spotify" ? "Spotify" : "YouTube"}</div><b>${esc(v.number1)}</b>
      <span>${pct(v.artists[0][1], 1)} of all chart points · ${S.F[v.artists[0][2]]}${v.artists[0][3] ? " · from " + esc(cname(v.artists[0][3])) : ""}</span></div>
    <h3>Genres <span style="text-transform:none;letter-spacing:0;font-weight:400">· known for ${pct(1 - g[g.length - 1])} of chart points</span></h3><div class="bar">${g.map((x, i) => `<i title="${S.F[i]} ${pct(x)}" style="width:${100 * x}%;background:${FAMC[S.F[i]]}"></i>`).join("")}</div>
    <div class="bl">${g.map((x, i) => [x, i]).filter(x => x[0] >= 0.04).sort((a, b) => b[0] - a[0]).map(([x, i]) => `<span><i class="dot" style="background:${FAMC[S.F[i]]}"></i> ${S.F[i]} ${pct(x)}</span>`).join("")}</div>
    <h3>Where the music comes from</h3><div class="bar"><i style="width:${100 * h.home}%;background:#ff5fa2"></i><i style="width:${100 * h.us}%;background:#5b8def"></i><i style="width:${100 * h.other}%;background:#ffd23f"></i><i style="width:${100 * h.unknown}%;background:#3a3658"></i></div>
    <div class="bl"><span><i class="dot" style="background:#ff5fa2"></i> home-grown ${pct(h.home)}</span><span><i class="dot" style="background:#5b8def"></i> US ${pct(h.us)}</span><span><i class="dot" style="background:#ffd23f"></i> elsewhere ${pct(h.other)}</span><span><i class="dot" style="background:#3a3658"></i> unknown ${pct(h.unknown)}</span></div>
    ${ov && S.plat === "both" ? `<h3>Spotify vs YouTube</h3><div class="sub">The two charts share ${pct(ov.overlap)} of their artists.</div>` : ""}
    ${twins ? `<h3>Musical twins</h3><div class="sub" style="line-height:1.6">${twins}</div>` : ""}
    <h3>Top artists</h3><ol class="list">${v.artists.slice(0, 10).map(a => `<li class="art" data-a="${a[4]}"><div class="t"><b>${esc(a[0])}</b><span><i class="dot" style="background:${FAMC[S.F[a[2]]]};width:7px;height:7px"></i> ${S.F[a[2]]}${a[3] ? " · " + flag(a[3]) : ""}</span></div><div class="v">${pct(a[1], 1)}</div></li>`).join("")}</ol>
    <h3>Top songs · tap to listen</h3><ol class="list">${v.songs.slice(0, 10).map(s => `<li><div class="t"><b>${esc(s[0])}</b><span>${esc(String(s[1]).split(" | ").slice(0, 3).join(", "))} · best #${s[4]} · ${s[5]} wk</span></div><div class="v">${s[2] ? `<button class="play sp" data-sp="${s[2]}" title="Spotify">▶</button>` : ""}${s[3] ? `<button class="play yt" data-yt="${s[3]}" title="YouTube">▶</button>` : ""}</div></li>`).join("")}</ol>`;
  document.querySelectorAll("#card [data-a]").forEach(el => el.onclick = () => { const i = +el.dataset.a; if (i >= 0) { S.artist = i; setView("artist"); } });
  document.querySelectorAll("#card [data-sp]").forEach(b => b.onclick = () => play("sp", b.dataset.sp));
  document.querySelectorAll("#card [data-yt]").forEach(b => b.onclick = () => play("yt", b.dataset.yt));
}
function play(kind, id) {
  $("#player").classList.remove("hidden");
  $("#pframe").innerHTML = kind === "sp" ? `<iframe src="https://open.spotify.com/embed/track/${encodeURIComponent(id)}?utm_source=generator&theme=0" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`
    : `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1" height="190" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
}

function setView(v) {
  S.view = v; document.querySelectorAll("[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  $("#asearch").classList.toggle("hidden", v !== "artist");
  if (v === "artist") $("#aq").value = S.A.artists[S.artist][0];
  if (v === "twins" && S.cc !== "global") S.twin = S.cc;
  paint();
}

function search() {
  const q = $("#aq").value.trim().toLowerCase(); if (q.length < 2) { $("#alist").innerHTML = ""; return; }
  const hits = []; for (let i = 0; i < S.A.artists.length && hits.length < 8; i++) if (S.A.artists[i][0].toLowerCase().includes(q)) hits.push(i);
  $("#alist").innerHTML = hits.map(i => `<div data-i="${i}"><i class="dot" style="background:${FAMC[S.F[S.A.artists[i][1]]]}"></i>${esc(S.A.artists[i][0])}</div>`).join("");
  document.querySelectorAll("#alist [data-i]").forEach(el => el.onclick = () => { S.artist = +el.dataset.i; $("#alist").innerHTML = ""; $("#aq").value = S.A.artists[S.artist][0]; paint(); });
}

async function main() {
  await load(); initMap();
  const cv = S.M.coverage; $("#cov").textContent = `Charts 1 Jan – ${new Date(cv.last_week).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} 2026 · 43 countries · Spotify Top 200 & YouTube Top 100`;
  const go = () => { if (S.ready) return; S.ready = true; paint(); card(); requestAnimationFrame(spin); };
  map.on("load", go); const p = setInterval(() => { if (S.ready) return clearInterval(p); if (map.isStyleLoaded()) { go(); clearInterval(p); } }, 300);
  document.querySelectorAll("[data-v]").forEach(b => b.onclick = () => setView(b.dataset.v));
  document.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { S.plat = b.dataset.p; document.querySelectorAll("[data-p]").forEach(x => x.classList.toggle("on", x === b)); paint(); card(); });
  $("#aq").oninput = search;
  $("#px").onclick = () => { $("#player").classList.add("hidden"); $("#pframe").innerHTML = ""; };
  $("#about-b").onclick = e => { e.preventDefault(); $("#about").classList.remove("hidden"); }; $("#ax").onclick = () => $("#about").classList.add("hidden");
}
let lastT = 0;
function spin(t) { if (S.spin && !S.manual && map) { const dt = Math.min(64, t - lastT); const c = map.getCenter(); c.lng -= dt * 0.004; map.setCenter(c); } lastT = t; requestAnimationFrame(spin); }
main();
