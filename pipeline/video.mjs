// LinkedIn media, rendered from the built site:
//   media/post1_genres.png · post2_homegrown.png · post3_twins.png (1080×1350) · day11_geography_of_sound.mp4 (~15 s) · thumb_full.jpg
//   node pipeline/video.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import http from "node:http";
import path from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json" };
http.createServer((req, res) => {
  const u = decodeURIComponent(new globalThis.URL(req.url, "http://x").pathname);
  const f = path.join("docs", u.endsWith("/") ? u + "index.html" : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Content-Length": fs.statSync(f).size });
  fs.createReadStream(f).pipe(res);
}).listen(8000);

const URL = "http://localhost:8000/", OUT = "media", FR = "media/frames", FPS = 15;
fs.mkdirSync(FR, { recursive: true });
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"];
const br = await chromium.launch({ args: ARGS });
const ready = p => p.waitForFunction(() => window.S && S.ready, null, { timeout: 120000 });
const settle = p => p.evaluate(() => new Promise(r => { let d = false; const f = () => { if (!d) { d = true; setTimeout(r, 40); } }; S.map.once("idle", f); S.map.triggerRepaint(); setTimeout(f, 3000); }));

// hub thumbnail: the desktop page
{
  const p = await br.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(URL, { waitUntil: "networkidle" }); await ready(p);
  await p.evaluate(() => { S.spin = false; S.map.jumpTo({ center: [10, 30], zoom: 1.95 }); });
  await settle(p); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/thumb_full.jpg`, type: "jpeg", quality: 90 }); await p.close();
}

const CSS = `
  #head, #card, #foot, #player, .maplibregl-ctrl-bottom-right { display: none !important; }
  #map { inset: 400px 0 230px 0 !important; }
  .v { position: absolute; z-index: 6; left: 50px; right: 50px; font-family: Inter; color: #f3f1fb; }
  .v.top { top: 46px; }
  .v .eb { font-size: 19px; letter-spacing: .18em; text-transform: uppercase; color: #8d88aa; font-weight: 600; }
  .v h1 { font-family: Unbounded, Inter; font-size: 66px; font-weight: 800; line-height: 1; letter-spacing: -.02em; margin: 10px 0 8px; }
  .v h1 span { background: linear-gradient(90deg, #ff5fa2, #ffb03d 40%, #22d3ee 75%, #7b6cff); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .v .q { font-size: 27px; color: #c4bfdc; line-height: 1.3; }
  .v.view { top: 300px; font-family: Unbounded, Inter; font-size: 34px; font-weight: 600; transition: none; }
  .v.view small { display: block; font-family: Inter; font-size: 21px; font-weight: 500; color: #b0abc8; margin-top: 6px; max-width: 900px; line-height: 1.35; }
  .v.bot { bottom: 46px; background: rgba(14,12,28,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 22px; padding: 22px 26px; backdrop-filter: blur(16px); }
  .v .chips { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 19px; color: #d6d2ea; }
  .v .chips i { display: inline-block; width: 14px; height: 14px; border-radius: 50%; margin-right: 7px; vertical-align: -1px; }
  .v .ramp { height: 14px; border-radius: 7px; } .v .ends { display: flex; justify-content: space-between; font-size: 18px; color: #b0abc8; margin-top: 6px; }
  .v .list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 26px; font-size: 20px; color: #e6e3f5; margin-top: 14px; }
  .v .list b { color: #fff; } .v .list span { color: #b0abc8; }
  .v .att { margin-top: 12px; font-size: 14px; color: #77729a; }
  .lbl { font-size: 15px !important; } .lbl small { font-size: 12px !important; }
  .card2 { position: absolute; z-index: 7; left: 60px; right: 60px; top: 360px; background: rgba(12,10,24,.9); border: 1px solid rgba(255,255,255,.12); border-radius: 28px; padding: 42px 46px; font-family: Inter; color: #f3f1fb; backdrop-filter: blur(18px); opacity: 0; }
  .card2 h2 { font-family: Unbounded; font-size: 46px; margin: 0 0 20px; line-height: 1.05; }
  .card2 li { font-size: 25px; line-height: 1.4; color: #d6d2ea; margin: 0 0 12px; } .card2 b { color: #fff; }
  .card2 .url { margin-top: 22px; font-size: 24px; font-weight: 700; color: #ff8fc0; } .card2 .att { margin-top: 8px; font-size: 15px; color: #77729a; }
`;
async function open() {
  const p = await br.newPage({ viewport: { width: 1080, height: 1350 } });
  p.on("console", m => m.type() === "error" && console.log("console:", m.text()));
  await p.goto(URL, { waitUntil: "networkidle" }); await ready(p);
  await p.addStyleTag({ content: CSS });
  await p.evaluate(() => { S.spin = false; S.manual = true; S.map.resize();
    document.body.insertAdjacentHTML("beforeend", `<div class="v top"><div class="eb">#30DayMapChallenge · Day 11 · Sound</div>
      <h1>The Geography <span>of Sound</span></h1><div class="q">What 43 countries listened to on Spotify and YouTube in 2026.</div></div>
      <div class="v view" id="vv"></div><div class="v bot" id="vb"></div>`); });
  return p;
}
const FAMC = { "Pop": "#ff5fa2", "Hip hop & rap": "#ffd23f", "Latin pop & urban": "#ff8a3d", "Regional Latin": "#e5383b", "Brazilian": "#2ee59d",
  "East Asian pop": "#8f7cff", "Afro & Caribbean": "#a3e635", "R&B & soul": "#e0b3ff", "Electronic & dance": "#22d3ee", "Rock & indie": "#5b8def",
  "Country": "#c99560", "Local & folk": "#f6bd60" };
// one scene = view + camera + captions (all set inside the page)
const scene = (p, o) => p.evaluate(({ o, FAMC }) => {
  const f = S.M.facts, pc = x => Math.round(100 * x) + "%";
  if (o.view !== S.view || o.twin !== S.twin) { if (o.fade != null) S.prev = { ...S.cols }; S.view = o.view; if (o.twin) S.twin = o.twin; }
  S.fadeK = o.fade ?? 1; S.map.jumpTo({ center: o.center, zoom: o.zoom, bearing: 0, pitch: 0 }); paint();
  const VV = document.getElementById("vv"), VB = document.getElementById("vb");
  if (o.view === "genre") {
    VV.innerHTML = `What the world played<small>Colour = each country's main genre. Label = its #1 artist of 2026 (Spotify + YouTube).</small>`;
    VB.innerHTML = `<div class="chips">${Object.entries(FAMC).map(([g, c]) => `<span><i style="background:${c}"></i>${g}</span>`).join("")}</div>`;
  } else if (o.view === "home") {
    VV.innerHTML = `Home-grown or imported?<small>Share of chart points going to artists from the country itself.</small>`;
    VB.innerHTML = `<div class="ramp" style="background:linear-gradient(90deg,#1d1a36,#3b2a6b,#8f3fb0,#ff5fa2,#ffd1e6)"></div><div class="ends"><span>mostly imported</span><span>mostly home-grown</span></div>
      <div class="list"><div><span>Most home-grown</span><br>${f.most_homegrown.slice(0, 4).map(x => `<b>${x[0]}</b> ${pc(x[1])}`).join("<br>")}</div>
      <div><span>Most US music</span><br>${f.most_us.slice(0, 4).map(x => `<b>${x[0]}</b> ${pc(x[1])}`).join("<br>")}</div></div>`;
  } else if (o.view === "twins") {
    VV.innerHTML = `Musical twins<small>How alike each country's 2026 charts are to ${S.M.countries[S.twin]?.name_en}. 1 = the same artists, in the same proportions.</small>`;
    VB.innerHTML = `<div class="ramp" style="background:linear-gradient(90deg,#1d1a36,#2c2a5c,#3f5bd6,#22d3ee,#eafcff)"></div><div class="ends"><span>different taste</span><span>musical twin</span></div>
      <div class="list">${f.twins.slice(0, 6).map(x => `<div><b>${x[0]} – ${x[1]}</b> ${x[2].toFixed(2)}</div>`).join("")}</div>`;
  } else if (o.view === "gap") {
    VV.innerHTML = `Spotify vs YouTube<small>How much a country's two charts share the same artists.</small>`;
    VB.innerHTML = `<div class="ramp" style="background:linear-gradient(90deg,#ff5fa2,#9b4fd6,#3b3a8f,#2f86c9,#7ef0ff)"></div><div class="ends"><span>different worlds</span><span>the same charts</span></div>
      <div class="list"><div><span>Most different</span><br>${f.platform_gap.filter(x => x[0] !== "Global").slice(0, 4).map(x => `<b>${x[0]}</b> ${pc(x[1])}`).join("<br>")}</div>
      <div><span>Most alike</span><br>${f.platform_alike.slice(-4).reverse().map(x => `<b>${x[0]}</b> ${pc(x[1])}`).join("<br>")}</div></div>`;
  }
  VB.insertAdjacentHTML("beforeend", `<div class="att">Charts 1 Jan – 15 Oct 2026 · Zenodo 23645386 (Spotify Top 200, YouTube Top 100) · genres: Wikidata · Natural Earth</div>`);
  if (o.card != null) {
    if (!document.getElementById("c2")) { const top = f.widest_reach.slice(0, 3).map(x => x[0]).join(", ");
      document.body.insertAdjacentHTML("beforeend", `<div class="card2" id="c2"><h2>The sound of 2026</h2><ul>
        <li>Widest reach: <b>${top}</b>, top 10 in the most countries.</li>
        <li>Most home-grown: <b>${f.most_homegrown.slice(0, 3).map(x => x[0]).join(", ")}</b>. Most US music: <b>${f.most_us.slice(0, 3).map(x => x[0]).join(", ")}</b>.</li>
        <li>Musical twins: <b>${f.twins[0][0]} – ${f.twins[0][1]}</b>, <b>${f.twins[2][0]} – ${f.twins[2][1]}</b>.</li></ul>
        <div class="url">Explore every country, artist and song · barisparlatangiller.github.io</div>
        <div class="att">Spotify Top 200 & YouTube Top 100 · Zenodo 23645386 (CC BY 4.0) · genres: Wikidata · Natural Earth</div></div>`); }
    document.getElementById("c2").style.opacity = o.card; VB.style.opacity = 1 - o.card; VV.style.opacity = 1 - o.card;
  }
}, { o, FAMC });

// ── 3 posters ──
let p = await open();
for (const [name, o] of [["post1_genres", { view: "genre", center: [5, 30], zoom: 2.1 }], ["post2_homegrown", { view: "home", center: [12, 22], zoom: 2.15 }],
  ["post3_twins", { view: "twins", twin: "gb", center: [10, 40], zoom: 2.05 }], ["post3b_spotify_vs_youtube", { view: "gap", center: [5, 30], zoom: 2.2 }]]) {
  await scene(p, o); await settle(p); await p.evaluate(() => placeLabels()); await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${name}.png` }); console.log("poster", name);
}

if (process.env.POSTERS_ONLY) { await br.close(); process.exit(0); }
// ── video: genres around the world → home-grown → musical twins → card ──
const plan = [];
const seg = (n, fn) => { for (let i = 0; i < n; i++) plan.push(fn(i / (n - 1 || 1), i)); };
const ease = k => k * k * (3 - 2 * k);
seg(100, k => ({ view: "genre", center: [-95 + 160 * ease(k), 22 + 10 * Math.sin(Math.PI * k)], zoom: 1.85 + 0.35 * Math.sin(Math.PI * k) }));
seg(42, k => ({ view: "home", fade: Math.min(1, k * 4), center: [65 - 50 * ease(k), 22], zoom: 1.9 + 0.2 * k }));
seg(45, k => ({ view: "twins", twin: "gb", fade: Math.min(1, k * 4), center: [15 - 5 * ease(k), 30 + 10 * ease(k)], zoom: 1.95 + 0.1 * ease(k) }));
seg(40, k => ({ view: "twins", twin: "gb", center: [10, 40], zoom: 2.05, card: Math.min(1, k * 4) }));
let n = 0;
for (const o of plan) {
  await scene(p, o); await settle(p); await p.evaluate(() => placeLabels());
  await p.screenshot({ path: `${FR}/f${String(n).padStart(4, "0")}.png` }); n++;
  if (n % 30 === 0) console.log("frame", n, new Date().toISOString());
}
fs.copyFileSync(`${FR}/f0060.png`, `${OUT}/cover.png`);
await br.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${FR}/f%04d.png`, "-vf", "minterpolate=fps=30:mi_mode=blend",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${OUT}/day11_geography_of_sound.mp4`]);
console.log(`${n} frames, ${(n / FPS).toFixed(1)} s, ${(fs.statSync(`${OUT}/day11_geography_of_sound.mp4`).size / 1e6).toFixed(2)} MB`);
fs.rmSync(FR, { recursive: true });
process.exit(0);
