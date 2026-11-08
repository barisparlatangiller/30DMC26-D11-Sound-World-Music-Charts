# The Geography of Sound — what did the world listen to in 2026?

**#30DayMapChallenge 2026 · Day 11 · Sound** · live map: https://barisparlatangiller.github.io/30DMC26-D11-Sound-World-Music-Charts/

A world map of 2026's charts in 43 countries, on Spotify and YouTube. Switch between **Genres**, **Home-grown**, **Artist**,
**Spotify vs YouTube** and **Musical twins**; between Spotify, YouTube or both; click any country for its #1 artist, top artists,
top songs (with a Spotify or YouTube player), genre mix, where its music comes from and its musical twins.

## Data
| | Source |
|---|---|
| Charts | Zenodo record 23645386 (CC BY 4.0): Spotify weekly Top 200 (37 countries + global; Türkiye and global weekly, the others every 4 weeks), YouTube weekly Top 100 (43 countries + global) |
| Period | 1 January – 15 October 2026 (the archive's last week; the brief asked for 8 November, the later weeks are not in the open archive) |
| Artist home | `song_home.csv` from the archive (Wikidata or chart origin) |
| Genres | Wikidata genre (P136), via the artists' Spotify IDs (P1902) and Google Knowledge Graph IDs (P646/P2671), grouped into 12 families |
| Borders | Natural Earth 1:50m |

## Method
- Chart position = (N + 1 − rank) / N points (N = 200 or 100), split among credited artists, averaged over the charted weeks.
- Share = an artist's part of all points in a country; "both" = mean of the Spotify and YouTube shares.
- Spotify vs YouTube = Σ min(share_spotify, share_youtube). Musical twins = cosine similarity of artist-share vectors.
- Only ranks are used: Spotify streams and YouTube views are different measures.

## Run
```
pip install -r requirements.txt
python pipeline/a_charts.py && python pipeline/b_genres.py && python pipeline/c_web.py
node pipeline/video.mjs     # LinkedIn images + video (Playwright, ffmpeg)
```
`docs/data/world_music_2026.gpkg` opens in QGIS (countries with #1 artist, top genre, home-grown and US shares, Spotify–YouTube overlap).

Data © the chart platforms via Zenodo (CC BY 4.0) · Wikidata (CC0) · Natural Earth. Barış Parlatangiller, built with Claude.
