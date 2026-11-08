"""
Chart points per artist and song, per country and platform, 1 January – 8 November 2026 (the archive ends 15 October 2026).

Source: Zenodo record 23645386 (CC BY 4.0) – Spotify weekly Top 200 (37 countries + global; TR and global weekly, the others every
4 weeks) and YouTube weekly Top 100 (43 countries + global).

Points: a chart position is worth (N + 1 − rank) / N (N = 200 or 100), shared equally between the credited artists. Points are
averaged over the weeks a country was charted, so 4-weekly and weekly charts compare; an artist's share = its points / all points.

  python pipeline/a_charts.py
Output  build/artist_country.parquet · build/songs.parquet · build/artists.parquet · build/coverage.json
"""
import json, re, unicodedata
from pathlib import Path

import pandas as pd

D, B = Path("data"), Path("build")
B.mkdir(exist_ok=True)
START, END = "2026-01-01", "2026-11-08"


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().casefold()
    return re.sub(r"[^a-z0-9]+", " ", s).strip() or str(s).casefold().strip()


def explode(df):
    """one row per credited artist; artist ids are kept only where their count matches the names"""
    a = df.artists.fillna("").str.split(r"\s*\|\s*")
    ids = df.aidcol.fillna("").str.split(r"\s*\|\s*")
    ok = a.str.len() == ids.str.len()
    ids = ids.where(ok, a.map(lambda v: [""] * len(v)))
    out = df.assign(artist=a, aid=ids, n_art=a.str.len()).explode(["artist", "aid"])
    out["akey"] = out.artist.map(norm)
    return out[out.akey != ""]


sp = pd.read_csv(D / "spotify_top200_positions_2026.csv", dtype={"track_id": str})
yt = pd.read_csv(D / "youtube_top100_positions_2026.csv", dtype={"key": str})
meta = pd.read_csv(D / "youtube_songs_metadata.csv", dtype=str)
sp = sp[(sp.week_end >= START) & (sp.week_end <= END)].assign(platform="spotify", N=200, song=lambda d: d.track_id, metric=lambda d: d.streams)
yt = yt[(yt.week_end >= START) & (yt.week_end <= END)].merge(meta[["key", "artist_ids"]], on="key", how="left")
yt = yt.assign(platform="youtube", N=100, song=lambda d: d.key, metric=lambda d: d.views)
sp["aidcol"] = sp.artist_uris.fillna("").str.replace("spotify:artist:", "", regex=False)
yt["aidcol"] = yt.artist_ids.fillna("")
ch = pd.concat([sp, yt], ignore_index=True)
ch["pts"] = (ch.N + 1 - ch["rank"]) / ch.N
weeks = ch.groupby(["platform", "cc"]).week_end.nunique().rename("n_weeks")
ch = ch.join(weeks, on=["platform", "cc"])

ex = explode(ch[["platform", "cc", "week_end", "rank", "song", "title", "artists", "pts", "n_weeks", "aidcol"]])
ex["p"] = ex.pts / ex.n_art / ex.n_weeks
ac = ex.groupby(["platform", "cc", "akey"]).agg(p=("p", "sum"), weeks=("week_end", "nunique"), best=("rank", "min")).reset_index()
ac["share"] = ac.p / ac.groupby(["platform", "cc"]).p.transform("sum")
ac.to_parquet(B / "artist_country.parquet")

# artists: display name (most common spelling), Spotify ids and Google KG ids (for genres), home country (from song_home)
names = ex.groupby(["akey", "artist"]).size().reset_index(name="n").sort_values("n").drop_duplicates("akey", keep="last").set_index("akey").artist
ids = ex[ex.aid != ""].groupby(["akey", "platform"]).aid.agg(lambda s: sorted(set(s))[:3]).unstack()
home = pd.read_csv(D / "song_home.csv", dtype=str)
home["akey"] = home.lead.fillna(home.artists.str.split(r"\s*\|\s*").str[0]).map(norm)
hmap = home.dropna(subset=["home_artist"]).groupby("akey").home_artist.agg(lambda s: s.mode().iloc[0])
art = pd.DataFrame({"name": names})
art["spotify_ids"] = ids.get("spotify").reindex(art.index) if "spotify" in ids else None
art["kg_ids"] = ids.get("youtube").reindex(art.index) if "youtube" in ids else None
art["home"] = hmap.reindex(art.index)
art["total"] = ac.groupby("akey").share.sum().reindex(art.index).fillna(0)
art = art.sort_values("total", ascending=False)
art.to_parquet(B / "artists.parquet")

so = ch.groupby(["platform", "cc", "song"]).agg(title=("title", "first"), artists=("artists", "first"), p=("pts", "sum"), n_weeks=("n_weeks", "first"),
                                               weeks=("week_end", "nunique"), best=("rank", "min"), metric=("metric", "sum")).reset_index()
so["p"] = so.p / so.n_weeks
so.to_parquet(B / "songs.parquet")

cov = {"start": START, "end_requested": END, "last_week": ch.week_end.max(), "platforms": {}}
for p, g in ch.groupby("platform"):
    cov["platforms"][p] = {cc: {"weeks": int(w), "first": g[g.cc == cc].week_end.min(), "last": g[g.cc == cc].week_end.max()} for cc, w in g.groupby("cc").week_end.nunique().items()}
(B / "coverage.json").write_text(json.dumps(cov, indent=1))
print(f"chart rows: spotify {len(sp):,}, youtube {len(yt):,} · last week {cov['last_week']}")
print(f"artists: {len(art):,} · with Spotify id {art.spotify_ids.notna().mean():.0%} · with KG id {art.kg_ids.notna().mean():.0%} · with home {art.home.notna().mean():.0%}")
print("top artists overall:", art.name.head(12).tolist())
