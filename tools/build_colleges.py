"""Build data/colleges.json (college name -> lat/long) from the IPEDS directory file.

Usage (from the project root):
    python3 tools/build_colleges.py 2024            # downloads HD2024.zip from NCES
    python3 tools/build_colleges.py path/HD2024.zip # or a local .zip / .csv

Keeps active, degree-granting institutions. Run again each year when NCES
publishes a newer HD file. Also records each college's website and looks up its logo
(Wikidata / Wikipedia, by IPEDS ID) for the student cards; add --no-logos to skip that. Colors and extra nicknames live in
data/college-extras.json, which this script never touches.
"""
import csv, io, json, os, re, sys, tempfile, time, urllib.error, urllib.parse, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "colleges.json")


def open_csv(arg):
    if arg.isdigit():
        url = f"https://nces.ed.gov/ipeds/datacenter/data/HD{arg}.zip"
        print("Downloading", url)
        tmp = os.path.join(tempfile.mkdtemp(), f"HD{arg}.zip")
        urllib.request.urlretrieve(url, tmp)
        arg = tmp
    if arg.lower().endswith(".zip"):
        z = zipfile.ZipFile(arg)
        name = next(n for n in z.namelist() if n.lower().endswith(".csv") and "_rv" not in n.lower())
        return io.TextIOWrapper(z.open(name), encoding="utf-8-sig", errors="replace")
    return open(arg, encoding="utf-8-sig", errors="replace")


UA = {"User-Agent": "WoodwardCollegeMap/1.0 (school lobby slideshow; build script)"}
LOGO_WORDS = re.compile(r"logo|seal|wordmark|emblem|crest|coat.of.arms|shield|monogram|insignia", re.I)


def get_json(url, data=None, tries=6):
    req = urllib.request.Request(url, data=data, headers={**UA, "Accept": "application/sparql-results+json"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=120) as f:
                return json.load(f)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == tries - 1:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 5 * 2 ** attempt   # be polite when rate-limited
            print(f"  rate-limited, waiting {wait}s ...")
            time.sleep(wait)


def find_logos():
    """IPEDS UNITID -> image file name on Wikipedia/Wikimedia Commons.
    Prefers the college's logo (Wikidata), then a logo/seal picture from its Wikipedia
    article, then its seal or coat of arms (Wikidata)."""
    print("Looking up logos on Wikidata ...")
    q = """SELECT ?ipeds (SAMPLE(?logo) AS ?l) (SAMPLE(?seal) AS ?s) (SAMPLE(?arms) AS ?c) (SAMPLE(?article) AS ?a)
           WHERE { ?item wdt:P1771 ?ipeds .
                   OPTIONAL { ?item wdt:P154 ?logo } OPTIONAL { ?item wdt:P158 ?seal }
                   OPTIONAL { ?item wdt:P94 ?arms }
                   OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> } }
           GROUP BY ?ipeds"""
    res = get_json("https://query.wikidata.org/sparql", urllib.parse.urlencode({"query": q}).encode())
    file_of = lambda b, k: urllib.parse.unquote(b[k]["value"].rsplit("/", 1)[1]) if k in b else ""
    found, articles = {}, {}
    for b in res["results"]["bindings"]:
        uid = b["ipeds"]["value"]
        if file_of(b, "l"):
            found[uid] = file_of(b, "l")
        else:
            if "a" in b:
                articles[urllib.parse.unquote(b["a"]["value"].rsplit("/wiki/", 1)[1]).replace("_", " ")] = uid
            fallback = file_of(b, "s") or file_of(b, "c")
            if fallback:
                found[uid] = fallback
    print(f"  {len(found)} from Wikidata; checking {len(articles)} Wikipedia articles ...")

    titles = list(articles)
    for i in range(0, len(titles), 50):
        params = {"action": "query", "prop": "pageimages", "piprop": "name", "format": "json",
                  "redirects": "1", "titles": "|".join(titles[i:i + 50])}
        d = get_json("https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params))
        back = {r["to"]: r["from"] for r in d["query"].get("redirects", [])}
        back.update({n["to"]: n["from"] for n in d["query"].get("normalized", [])})
        for p in d["query"]["pages"].values():
            name = p.get("pageimage", "")
            title = back.get(p.get("title"), p.get("title"))
            uid = articles.get(title) or articles.get(back.get(title, ""))
            if uid and name and LOGO_WORDS.search(name):
                found[uid] = name.replace("_", " ")
        time.sleep(1)
    print(f"  {len(found)} colleges have a logo or seal")
    return found


def main():
    global args
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    reader = csv.DictReader(open_csv(args[0]))
    rows = []
    for r in reader:
        if r["CYACTIVE"] != "1" or r["DEGGRANT"] != "1":
            continue
        try:
            lat, lon = round(float(r["LATITUDE"]), 4), round(float(r["LONGITUD"]), 4)
        except ValueError:
            continue
        aliases = "|".join(a.strip() for a in r["IALIAS"].replace(",", "|").split("|") if a.strip())
        size = int(r["INSTSIZE"]) if r["INSTSIZE"].lstrip("-").isdigit() else 0
        web = re.sub(r"^(https?://)?(www\.)?", "", r["WEBADDR"].strip().lower()).split("/")[0]
        rows.append([r["INSTNM"].strip(), r["CITY"].strip(), r["STABBR"], lat, lon, aliases, max(size, 0),
                     web, r["UNITID"]])

    logos = {} if "--no-logos" in sys.argv else find_logos()
    for row in rows:
        row.append(logos.get(row[8], ""))
        del row[8]   # UNITID was only needed to match logos

    out = {
        "source": "IPEDS HD directory file, NCES (" + os.path.basename(args[0]) + "); logos: Wikidata / Wikipedia",
        "fields": ["name", "city", "state", "lat", "lon", "aliases", "size", "web", "logo"],
        "rows": rows,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(rows)} colleges to {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
