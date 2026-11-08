#!/usr/bin/env python3
"""2026 Spotify + YouTube chart CSV'lerini 08-11-2026'ya kadar QGIS icin hazirlar.
Kaynak: https://zenodo.org/records/23645386
Not: Arsiv 15-10-2026'da sona eriyor; bulunmayan haftalari uretmez.
Kullanim: python spotify_youtube_2026_hazirla.py
Internet erisiminiz yoksa CSV.GZ dosyalarini script yanina indirip yeniden calistirin.
"""
from pathlib import Path
from urllib.request import urlretrieve
import csv, gzip, collections, zipfile
ROOT=Path(__file__).resolve().parent
RAW=ROOT/'chart_2026_raw'; OUT=ROOT/'chart_2026_qgis'; RAW.mkdir(exist_ok=True); OUT.mkdir(exist_ok=True)
BASE='https://zenodo.org/records/23645386/files/'
FILES=['spotify_top200_positions_2026.csv.gz','youtube_top100_positions_2026.csv.gz','language.csv']
for name in FILES:
    p=RAW/name
    if not p.exists():
        print('Indiriliyor:',name)
        try: urlretrieve(BASE+name+'?download=1',p)
        except Exception as e:
            print('Indirme basarisiz:',e)
            print('Manuel indirme:',BASE+name+'?download=1')
            raise SystemExit('Gerekli dosyalar RAW klasorunde olmali.')

def reader(path):
    opener=gzip.open if str(path).endswith('.gz') else open
    with opener(path,'rt',encoding='utf-8-sig',newline='') as f:
        yield from csv.DictReader(f)

end='2026-11-08'; start='2026-01-01'
weeks=collections.defaultdict(set); totals=collections.Counter(); unique=collections.defaultdict(set)
country_names={r.get('cc',''):r.get('country','') for r in reader(RAW/'language.csv')}
for platform,name in [('spotify','spotify_top200_positions_2026.csv.gz'),('youtube','youtube_top100_positions_2026.csv.gz')]:
    source=RAW/name
    dest=OUT/(platform+'_2026_01_01_11_08_available.csv')
    with dest.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f)
        w.writerow(['platform','cc','week_end','rank','track_key','title','artists','metric','metric_name','genre','genre_source'])
        for r in reader(source):
            dt=r.get('week_end',''); cc=r.get('cc',''); rank=r.get('rank','')
            if not start<=dt<=end: continue
            try: rank_num=int(rank)
            except: continue
            key=r.get('track_id','') if platform=='spotify' else r.get('key','')
            metric=r.get('streams','') if platform=='spotify' else r.get('views','')
            w.writerow([platform,cc,dt,rank_num,key,r.get('title',''),r.get('artists',''),metric,'chart_streams' if platform=='spotify' else 'weekly_views','',''])
            weeks[(platform,cc)].add(dt); totals[(platform,cc)]+=1
            unique[(platform,cc)].add(key)
    print('Hazir:',dest)
with (OUT/'coverage_2026.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['platform','cc','country','n_chart_weeks','first_week','last_week','n_positions','unique_track_keys','coverage_note'])
    for (p,cc),ds in sorted(weeks.items()):
        w.writerow([p,cc,country_names.get(cc,''),len(ds),min(ds),max(ds),totals[(p,cc)],len(unique[(p,cc)]),'Spotify many countries sampled 4-weekly' if p=='spotify' and cc not in ('tr','global') else 'Weekly archive'])
with (OUT/'genre_template.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.writer(f);w.writerow(['platform','track_key','genre','genre_source','genre_confidence'])
with (OUT/'README_TR.txt').open('w',encoding='utf-8') as f:
    f.write('2026 01 Ocak–08 Kasim filtrelenmistir; arsivdeki son chart haftasi 15 Ekim 2026.\n')
    f.write('Spotify: 37 ulke, TR+Global haftalik, digerleri 4 haftada bir. YouTube: 43 ulke haftalik.\n')
    f.write('Genre chart pozisyon dosyalarinda yoktur; genre_template.csv anahtarla zenginlestirme icin.\n')
    f.write('Spotify chart streams ve YouTube views dogrudan esit olcek degildir.\n')
    f.write('QGIS: CSV join icin cc ISO-2 alanini kullanin, global kaydini dislayin.\n')
    f.write('Kaynak https://zenodo.org/records/23645386 (CC BY 4.0; platform kullanim kosullari sakli).\n')
zip_path=ROOT/'Spotify_YouTube_2026_QGIS_arsivden.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for p in OUT.glob('*'):z.write(p,arcname=p.name)
print('Paket:',zip_path)
