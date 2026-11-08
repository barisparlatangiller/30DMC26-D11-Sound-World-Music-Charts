"""
Web data for the map: per country and platform (Spotify, YouTube, both) the top artists and songs, genre shares, where the music
comes from (home-grown / US / elsewhere), how alike Spotify and YouTube are, and "musical twins" (countries that chart alike).

  both platforms   = the mean of a country's Spotify and YouTube artist shares (just one where only one is charted)
  Spotify–YouTube  = overlap of the two artist-share distributions, Σ min(spotify, youtube): 1 = identical, 0 = nothing in common
  musical twins    = cosine similarity of two countries' artist-share vectors

  python pipeline/c_web.py
Output  docs/data/countries.geojson · docs/data/music.json · docs/data/artists.json · build/world_music_2026.gpkg
"""
import json, re, unicodedata
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import requests

D, B, W = Path("data"), Path("build"), Path("docs/data")
W.mkdir(parents=True, exist_ok=True)
FAMS = ["Pop", "Hip hop & rap", "Latin pop & urban", "Regional Latin", "Brazilian", "East Asian pop", "Afro & Caribbean",
        "R&B & soul", "Electronic & dance", "Rock & indie", "Country", "Local & folk", "Unclassified"]
PL = ["spotify", "youtube"]
TOPN_ART, TOPN_SONG, N_ARTISTS = 15, 15, 3000


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().casefold()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


lang = pd.read_csv(D / "language.csv")
ac = pd.read_parquet(B / "artist_country.parquet")
art = pd.read_parquet(B / "artists.parquet")
so = pd.read_parquet(B / "songs.parquet")
cov = json.loads((B / "coverage.json").read_text())
gp = B / "genres.parquet"
gdf = pd.read_parquet(gp).set_index("akey") if gp.exists() else pd.DataFrame(columns=["family", "genres"])
art["family"] = gdf.family.reindex(art.index).fillna("Unclassified")
art["genres"] = gdf.genres.reindex(art.index).fillna("")

# countries (Natural Earth 1:50m)
f = B / "ne_50m.geojson"
if not f.exists():
    r = requests.get("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson", timeout=300)
    r.raise_for_status(); f.write_bytes(r.content)
ne = gpd.read_file(f)
ne["cc"] = ne.ISO_A2_EH.str.lower()
ne = ne[ne.cc.str.len() == 2][["cc", "NAME_EN", "LABEL_X", "LABEL_Y", "geometry"]].rename(columns={"NAME_EN": "name"})
ne["area"] = ne.to_crs(6933).area                                # several pieces share a code (e.g. AU): name from the largest
ne = ne.sort_values("area", ascending=False).dissolve("cc", aggfunc="first").reset_index()
LABEL = {r.cc: [round(r.LABEL_X, 3), round(r.LABEL_Y, 3)] for r in ne.itertuples()}
ne = ne[["cc", "name", "geometry"]]
ne.loc[ne.cc == "us", "name"] = "United States"
ne = ne[ne.cc != "aq"]
ne["geometry"] = ne.simplify(0.05)

# ── artist shares per platform, plus "both" ──
sh = ac.pivot_table(index=["cc", "akey"], columns="platform", values="share", aggfunc="sum").fillna(0)
have = ac.groupby(["cc", "platform"]).size().unstack().notna()
both = []
for cc, g in sh.groupby(level=0):
    ps = [p for p in PL if p in have.columns and have.loc[cc, p]]
    both.append(g[ps].mean(axis=1))
sh["both"] = pd.concat(both)
best = ac.pivot_table(index=["cc", "akey"], columns="platform", values="best", aggfunc="min")
ccs = sorted(set(ac.cc))
akeys = list(art.index[:N_ARTISTS]); aidx = {k: i for i, k in enumerate(akeys)}
home = art.home.to_dict(); fam = art.family.to_dict()

out = {"genre_coverage": None, "families": FAMS, "coverage": cov, "countries": {}, "views": {p: {} for p in PL + ["both"]}, "labels": {cc: LABEL[cc] for cc in ccs if cc in LABEL}}
for _, r in lang.iterrows():
    out["countries"][r.cc] = {"name": r.country_tr, "lang": r.main_language, "region": r.region}
names_en = dict(zip(ne.cc, ne.name)); names_en["global"] = "Global"
for cc in ccs: out["countries"].setdefault(cc, {})["name_en"] = names_en.get(cc, cc.upper())

so["skey"] = so.title.map(lambda t: norm(re.sub(r"\(.*?\)|\[.*?\]", "", str(t)))) + "|" + so.artists.fillna("").str.split(r"\s*\|\s*").str[0].map(norm)
so["ps"] = so.p / so.groupby(["platform", "cc"]).p.transform("sum")

vec = {}
for view in PL + ["both"]:
    V = {}
    for cc in ccs:
        if view != "both" and not (view in have.columns and have.loc[cc, view]): continue
        s = sh.loc[cc][view]; s = s[s > 0].sort_values(ascending=False)
        if s.empty: continue
        vec[(view, cc)] = s
        g = np.zeros(len(FAMS))
        for k, v in s.items(): g[FAMS.index(fam.get(k, "Unclassified"))] += v
        h = {"home": 0.0, "us": 0.0, "other": 0.0, "unknown": 0.0}
        for k, v in s.items():
            hh = home.get(k)
            h["unknown" if not isinstance(hh, str) else "home" if hh == cc else "us" if hh == "us" else "other"] += v
        top = []
        for k, v in s.head(TOPN_ART).items():
            b = best.loc[(cc, k)] if (cc, k) in best.index else None
            top.append([art.name.get(k, k), round(float(v), 4), FAMS.index(fam.get(k, "Unclassified")), home.get(k) if isinstance(home.get(k), str) else "",
                        aidx.get(k, -1), int(np.nanmin(b.values)) if b is not None else None])
        ss = so[so.cc == cc] if view == "both" else so[(so.cc == cc) & (so.platform == view)]
        if view == "both":
            agg = ss.groupby("skey").agg(title=("title", "first"), artists=("artists", "first"), ps=("ps", "sum"), best=("best", "min"), weeks=("weeks", "max"),
                                         sp=("song", lambda x: next((v for v, p in zip(x, ss.loc[x.index, "platform"]) if p == "spotify"), "")),
                                         yt=("song", lambda x: next((v for v, p in zip(x, ss.loc[x.index, "platform"]) if p == "youtube"), "")))
            agg["ps"] = agg.ps / max(1, ss.platform.nunique())
        else:
            agg = ss.assign(sp=np.where(ss.platform == "spotify", ss.song, ""), yt=np.where(ss.platform == "youtube", ss.song, ""))
        agg = agg.sort_values("ps", ascending=False).head(TOPN_SONG)
        songs = [[r.title, r.artists, r.sp, r.yt, int(r.best), int(r.weeks), round(float(r.ps), 4)] for r in agg.itertuples()]
        V[cc] = {"genre": [round(float(x), 4) for x in g], "home": {k: round(v, 4) for k, v in h.items()}, "artists": top, "songs": songs,
                 "n_artists": int(len(s)), "number1": top[0][0]}
    out["views"][view] = V

# Spotify ↔ YouTube overlap, and genre gap
out["overlap"] = {}
for cc in ccs:
    if ("spotify", cc) in vec and ("youtube", cc) in vec:
        a, b = vec[("spotify", cc)], vec[("youtube", cc)]
        j = pd.concat([a, b], axis=1).fillna(0)
        ga, gb = np.array(out["views"]["spotify"][cc]["genre"]), np.array(out["views"]["youtube"][cc]["genre"])
        out["overlap"][cc] = {"overlap": round(float(np.minimum(j.iloc[:, 0], j.iloc[:, 1]).sum()), 3),
                              "genre_gap": round(float(0.5 * np.abs(ga - gb).sum()), 3)}

# musical twins
out["twins"] = {}
for view in PL + ["both"]:
    cs = [cc for cc in ccs if (view, cc) in vec and cc != "global"]
    M = pd.concat([vec[(view, cc)].rename(cc) for cc in cs], axis=1).fillna(0).values
    M = M / np.linalg.norm(M, axis=0, keepdims=True)
    S = M.T @ M
    out["twins"][view] = {"cc": cs, "sim": [[round(float(x), 3) for x in row] for row in S]}

# artists → world
ccx = {cc: i for i, cc in enumerate(ccs)}
A = {"cc": ccs, "artists": [[art.name.get(k, k), FAMS.index(fam.get(k, "Unclassified")), home.get(k) if isinstance(home.get(k), str) else "",
                              art.genres.get(k, "")] for k in akeys], "reach": {}}
for view in PL + ["both"]:
    R = [[] for _ in akeys]
    for (v, cc), s in vec.items():
        if v != view: continue
        rk = s.rank(ascending=False, method="min")
        for k in s.index.intersection(akeys):
            R[aidx[k]].append([ccx[cc], round(float(s[k]), 5), int(rk[k])])
    A["reach"][view] = R
(W / "artists.json").write_text(json.dumps(A, ensure_ascii=False, separators=(",", ":")))

# headline facts (computed, used by the map and the posters)
bv = out["views"]["both"]
real = [cc for cc in bv if cc != "global"]
homeg = sorted(real, key=lambda cc: -bv[cc]["home"]["home"])
usd = sorted([cc for cc in real if cc != "us"], key=lambda cc: -bv[cc]["home"]["us"])
ov = sorted(out["overlap"].items(), key=lambda x: x[1]["overlap"])
n1 = pd.Series([bv[cc]["number1"] for cc in real]).value_counts()
tw = out["twins"]["both"]; S = np.array(tw["sim"]); np.fill_diagonal(S, -1)
pairs = sorted({tuple(sorted((tw["cc"][i], tw["cc"][int(S[i].argmax())]))) for i in range(len(S))}, key=lambda p: -S[tw["cc"].index(p[0]), tw["cc"].index(p[1])])
reach = sorted(((A["artists"][i][0], sum(1 for c in A["reach"]["both"][i] if A["cc"][c[0]] != "global" and c[2] <= 10)) for i in range(len(akeys))), key=lambda x: -x[1])
nm = lambda cc: out["countries"][cc].get("name_en", cc)
out["facts"] = {
    "most_homegrown": [[nm(cc), round(bv[cc]["home"]["home"], 3)] for cc in homeg[:5]],
    "least_homegrown": [[nm(cc), round(bv[cc]["home"]["home"], 3)] for cc in homeg[-5:]],
    "most_us": [[nm(cc), round(bv[cc]["home"]["us"], 3)] for cc in usd[:5]],
    "platform_gap": [[nm(cc), v["overlap"]] for cc, v in ov[:5]], "platform_alike": [[nm(cc), v["overlap"]] for cc, v in ov[-5:]],
    "number1_count": n1.head(6).to_dict(),
    "twins": [[nm(a), nm(b), round(float(S[tw["cc"].index(a), tw["cc"].index(b)]), 2)] for a, b in pairs[:8]],
    "widest_reach": reach[:10],
    "genre_world": dict(zip(FAMS, [round(x, 3) for x in (np.array([bv[cc]["genre"] for cc in real]).mean(0))])),
}
out["genre_coverage"] = {cc: round(1 - v["genre"][-1], 3) for cc, v in out["views"]["both"].items()}
(W / "music.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))

ne.to_file(W / "countries.geojson", driver="GeoJSON", COORDINATE_PRECISION=3)
g = ne.copy()
for col, fn in [("number1", lambda cc: bv.get(cc, {}).get("number1")), ("top_genre", lambda cc: FAMS[int(np.argmax(bv[cc]["genre"][:-1]))] if cc in bv else None),
                ("homegrown", lambda cc: bv.get(cc, {}).get("home", {}).get("home")), ("us_share", lambda cc: bv.get(cc, {}).get("home", {}).get("us")),
                ("sp_yt_overlap", lambda cc: out["overlap"].get(cc, {}).get("overlap"))]:
    g[col] = g.cc.map(fn)
g.to_file(B / "world_music_2026.gpkg", layer="countries_2026")
import shutil; shutil.copy(B / "world_music_2026.gpkg", W / "world_music_2026.gpkg")
print(json.dumps(out["facts"], indent=1, ensure_ascii=False))
print({k: round(v.stat().st_size / 1e6, 2) for k, v in [(p.name, p) for p in W.iterdir()]})
