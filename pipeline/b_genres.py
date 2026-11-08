"""
Genres for the charted artists, from Wikidata (genre P136), matched by Spotify artist ID (P1902), Freebase ID (P646, "/m/…")
and Google Knowledge Graph ID (P2671, "/g/…"). Wikidata genres are grouped into 12 families with simple keyword rules (FAMILY
below); an artist takes the family most of its genres fall into. Artists without a Wikidata genre stay "unclassified".

  python pipeline/b_genres.py
Output  build/genres.parquet (akey, family, genres)
"""
import json, re, time
from collections import Counter
from pathlib import Path

import pandas as pd
import requests

B = Path("build")
TOP = 8000                                   # the most-charted artists (they hold almost all chart points)
UA = {"User-Agent": "30DMC26-WorldMusicCharts/1.0 (GitHub Actions; educational map)", "Accept": "application/sparql-results+json"}

FAMILY = [  # (family, keywords) — checked in this order, so specific scenes win over "pop" or "rock"
    ("East Asian pop", r"k-pop|j-pop|j-rock|anime|city pop|c-pop|mandopop|cantopop|korean|japanese|k-hip|j-hip|visual kei|enka|kayōkyoku|idol"),
    ("Regional Latin", r"corrido|banda|norte[nñ]o|regional mexican|mariachi|ranchera|cumbia|sierre[nñ]o|grupero|bachata|vallenato|salsa|merengue|cuarteto|tango|bolero"),
    ("Brazilian", r"sertanejo|funk carioca|brazilian|funk brasileiro|pagode|forr[oó]|ax[eé]|mpb|piseiro|arrocha|samba|bossa"),
    ("Afro & Caribbean", r"afro|amapiano|bongo flava|gengetone|highlife|kwaito|gqom|dancehall|soca|reggae(?!ton)|zouk|kizomba|chimurenga|zimdancehall|benga|taarab|singeli|rumba congolaise|soukous|naija"),
    ("Latin pop & urban", r"reggaet|latin trap|urbano|dembow|latin hip|moombahton|latin pop|latin music|perreo|latin r&b|trap latino"),
    ("Hip hop & rap", r"hip hop|hip-hop|rap|trap|drill|grime|gangsta|boom bap|crunk|phonk"),
    ("R&B & soul", r"r&b|rhythm and blues|soul|funk|gospel|motown|quiet storm"),
    ("Electronic & dance", r"electro|house|techno|edm|dance music|trance|dubstep|drum and bass|eurodance|hardstyle|hardcore|garage|disco(?! polo)|ambient|idm|breakbeat|future bass"),
    ("Rock & indie", r"rock|metal|punk|indie|alternative|grunge|emo|shoegaze|post-|new wave|britpop"),
    ("Country", r"country|americana|bluegrass|honky"),
    ("Local & folk", r"schlager|folk|manele|turbo|arabesk|chanson|disco polo|volks|fado|flamenco|chalga|traditional|world music|filmi|bollywood|estrada|canzone|cantautor|italo|neomelodic|sevdah|halk|türkü|fantezi|tallava|opera|classical|musical|soundtrack|children"),
    ("Pop", r"pop|ballad|singer-songwriter|soft rock|adult contemporary"),
]
FAMS = [f for f, _ in FAMILY]


def family(genres):
    hits = Counter()
    for g in genres:
        g = g.lower()
        for i, (f, rx) in enumerate(FAMILY):
            if re.search(rx, g): hits[f] += 1; break
    if not hits: return "Unclassified"
    top = max(hits.values())
    return min((f for f, n in hits.items() if n == top), key=FAMS.index)


def sparql(prop, ids):
    vals = " ".join(json.dumps(i) for i in ids)
    q = f"""SELECT ?id ?gLabel WHERE {{ VALUES ?id {{ {vals} }} ?a wdt:{prop} ?id . ?a wdt:P136 ?g .
            ?g rdfs:label ?gLabel FILTER(LANG(?gLabel) = "en") }}"""
    for k in range(5):
        try:
            r = requests.post("https://query.wikidata.org/sparql", data={"query": q}, headers=UA, timeout=120)
            if r.status_code == 429: time.sleep(20 * (k + 1)); continue
            r.raise_for_status()
            return [(b["id"]["value"], b["gLabel"]["value"]) for b in r.json()["results"]["bindings"]]
        except Exception as e:
            print("  retry", prop, type(e).__name__, str(e)[:120], flush=True); time.sleep(10 * (k + 1))
    return []


if __name__ == "__main__":
    art = pd.read_parquet(B / "artists.parquet").head(TOP)
    want = {"P1902": set(), "P646": set(), "P2671": set()}
    for _, r in art.iterrows():
        for i in (r.spotify_ids if r.spotify_ids is not None else []): want["P1902"].add(i)
        for i in (r.kg_ids if r.kg_ids is not None else []):
            want["P646" if i.startswith("/m/") else "P2671"].add(i)
    found = {}
    for prop, ids in want.items():
        ids = sorted(ids)
        for c in range(0, len(ids), 250):
            for i, g in sparql(prop, ids[c:c + 250]): found.setdefault(i, set()).add(g)
            time.sleep(1.0)
        print(f"{prop}: {len(ids):,} ids queried · {sum(1 for i in ids if i in found):,} with a genre", flush=True)
    rows = []
    for k, r in art.iterrows():
        gs = set()
        for i in list(r.spotify_ids if r.spotify_ids is not None else []) + list(r.kg_ids if r.kg_ids is not None else []): gs |= found.get(i, set())
        rows.append({"akey": k, "family": family(gs), "genres": "; ".join(sorted(gs))})
    g = pd.DataFrame(rows)
    g.to_parquet(B / "genres.parquet")
    w = art.total.values
    print(f"artists with a genre: {(g.family != 'Unclassified').mean():.0%} · share of chart points with a genre: {w[(g.family != 'Unclassified').values].sum() / w.sum():.0%}")
    print(g.family.value_counts().to_string())
    print(g.head(25).to_string())
