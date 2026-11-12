"""Add student photos to assets/photos/ and rebuild assets/photos/index.json.

Usage (from the project root, on a Mac):
    python3 tools/import_photos.py "Senior Portraits"   # import a downloaded folder of photos
    python3 tools/import_photos.py                      # only rebuild the index

Importing names each photo "First Last.jpg" ("Doe,Jane.JPG" and "Doe, Jane(1).jpg" become
"Jane Doe.jpg") and shrinks it to 800 px on its long side with macOS's `sips`, so the TV
loads it fast. A photo with the same name already in assets/photos/ is replaced.

The slideshow reads index.json to give each student with an empty Photo cell the photo that
has their name (capital letters, accents, punctuation and word order don't matter). A
nickname won't match: rename the file to the sheet's spelling, e.g. "Sam Hartman.jpg" ->
"Samuel Hartman.jpg", then run this again.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, "assets", "photos")
IMAGE = re.compile(r"\.(jpe?g|png|webp|heic)$", re.I)


def nice_name(filename):
    base = re.sub(r"\(\d+\)$", "", os.path.splitext(filename)[0]).strip()
    if "," in base:
        last, first = base.split(",", 1)
        base = f"{first.strip()} {last.strip()}"
    return re.sub(r"\s+", " ", base)


def import_folder(folder):
    files = sorted(f for f in os.listdir(folder) if IMAGE.search(f))
    # Newest first, so an older copy ("Doe,Jane(1).jpg") never replaces a newer one.
    files.sort(key=lambda f: os.path.getmtime(os.path.join(folder, f)), reverse=True)
    done = set()
    for f in files:
        name = nice_name(f)
        if name.lower() in done:
            print(f"  skipped {f} (older copy of {name})")
            continue
        done.add(name.lower())
        out = os.path.join(PHOTOS, name + ".jpg")
        subprocess.run(["sips", "-Z", "800", "-s", "format", "jpeg", "-s", "formatOptions", "78",
                        os.path.join(folder, f), "--out", out], check=True, capture_output=True)
    print(f"Imported {len(done)} photos into assets/photos/")


def build_index():
    files = sorted(f for f in os.listdir(PHOTOS) if IMAGE.search(f))
    with open(os.path.join(PHOTOS, "index.json"), "w") as fh:
        json.dump(files, fh, indent=0, ensure_ascii=False)
        fh.write("\n")
    print(f"Wrote assets/photos/index.json ({len(files)} photos)")


if __name__ == "__main__":
    os.makedirs(PHOTOS, exist_ok=True)
    if len(sys.argv) > 1:
        import_folder(sys.argv[1])
    build_index()
