# War Eagles College Map

Looping lobby-TV slideshow: Eddy the Eagle flies from Woodward Academy to each senior's college.
Full requirements are in [SPEC.md](SPEC.md).

**Live:** https://27lyu-pixel.github.io/woodward-college-map/ (GitHub Pages, from the `main` branch).
Students come from the counselors' Google Sheet, so adding students needs no change here.

## Publish on GitHub Pages
Already set up. To change the code or artwork, push to `main`; the site updates within a minute or two.
To set it up again elsewhere:
1. Create a GitHub repository and upload everything in this folder.
2. Repository **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The slideshow is live at `https://<your-user>.github.io/<repo>/` within a minute or two.

## Connect the Google Sheet
**Easiest:** start from [sheet/College Acceptances.xlsx](sheet/College%20Acceptances.xlsx), a ready-made
sheet for counselors with dropdowns, a date picker, row colors and a "How to use" tab. Upload it to
Google Drive, open it, choose File > Save as Google Sheets, then follow step 2 below with its
**Students** tab. (Rebuild it with `python3 tools/make_counselor_sheet.py`.)

1. Columns, in this order: `Rotation start | Student name | College | City | State | Status`.
   A blank "Rotation start" means "same as the row above".
   City and State are optional: they're filled in from the college list (needed only for colleges
   that aren't in it).
   Status is `Accepted` or `Committed` (blank counts as Accepted). Committed students get a solid
   crimson tag and a solid pin; accepted ones get an outlined tag and a ring pin. A student can
   have several Accepted rows (one per college); the finale counts each student once.
2. **File → Share → Publish to web**, pick the sheet, format **CSV**, Publish, and copy the link.
3. Paste it as `data.csvUrl` in [js/config.js](js/config.js).
   To try a sheet before switching, open the slideshow with `?csv=` plus the link at the end of the URL.

The page plays only rows from the latest rotation date on or before today, and reloads itself
when the date changes. Rows play in sheet order, moved only as much as needed so a Georgia
college never plays first and two students at the same college never play back to back
(`order` in [js/config.js](js/config.js)). If the sheet can't be reached, it plays the last copy that loaded.

## Run it on the TV
Open the page in Chrome in kiosk mode so it fills the screen with no browser bars, e.g.
`google-chrome --kiosk https://<your-user>.github.io/<repo>/` (or press F11 for full screen).

## Check the data
Add `?debug=1` to the URL (or press **D**) to see which rotation is playing, how each college
matched, and any flagged rows. Add `&today=2026-11-20` to preview another date.

## Common edits
| What | Where |
|---|---|
| Colors | top of [css/style.css](css/style.css) |
| Timings, title text, totals scope (`batch` / `season`) | [js/config.js](js/config.js) |
| Category wording ("has committed to", "was accepted to") and what a blank Status means | `categories` in [js/config.js](js/config.js) |
| Atlanta-area zoom for nearby colleges (radius, zoom level) | `map.local` in [js/config.js](js/config.js) |
| College colors and nicknames, colleges missing from IPEDS | [data/college-extras.json](data/college-extras.json) |
| A college's logo on the card is wrong or missing: put an image in `assets/logos/` and add `"logo": "assets/logos/name.png"` to that college | [data/college-extras.json](data/college-extras.json) |
| Turn card logos off, or stop using website icons as a fallback | `card.logos` in [js/config.js](js/config.js) |
| Which Eddy plays: `"drawn"` or `"higgsfield"` (compare both at `/tools/eddy-sheet.html`, or add `?eddy=higgsfield` to the URL) | `eddy.art` in [js/config.js](js/config.js) |
| Eddy artwork (facing right; 2+ wing frames + perched) | `assets/eddy/` (drawn, `tools/draw_eddy.py`), `assets/eddy-hf/` (Higgsfield, fitted by `tools/fit_eddy_png.py`) |
| Refresh the IPEDS college list and logos (yearly) | `python3 tools/build_colleges.py 2025` |

## Test locally
`python3 serve.py`, then open http://localhost:8642 (opening `index.html` directly won't load the data).
