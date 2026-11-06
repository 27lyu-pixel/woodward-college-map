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
Google Drive, open it, choose File > Save as Google Sheets, then follow step 2 below.
(Rebuild it with `python3 tools/make_counselor_sheet.py`; add `--rows <published CSV link> --out
sheet/private/new.xlsx` to start it with the students from an older sheet. `sheet/private/` stays out of git.)

Counselors type on the **Students** tab, which is private. The **TV feed** tab copies it by formula, leaving
out the scholarship amounts and adding the year's total, and it's the only tab that's published.

1. Students tab columns, in this order: `Rotation start | Student name | College | City | State | Status | Scholarship | Photo`.
   A blank "Rotation start" means "same as the row above".
   City and State are optional: they're filled in from the college list (needed only for colleges
   that aren't in it).
   Status is `Accepted` or `Committed` (blank counts as Accepted). Committed students get a solid
   crimson tag and a solid pin; accepted ones get an outlined tag and a ring pin. A student can
   have several Accepted rows (one per college); the finale counts each student once.
   Photo is optional: the student's yearbook photo for the card. Paste a Google Drive link (share
   the photo as "Anyone with the link"), or put the file in `assets/photos/` and type its file name.
   Students without a photo show their initials. Turn the spot off with `card.photos` in [js/config.js](js/config.js).
   To fill in Photo automatically, see "Match photos automatically" below.
   Scholarship is optional and private: see "Scholarship total" below.
2. **File → Share → Publish to web → Published content & settings**: tick **only TV feed**. Never
   Students or "Entire document": those would publish each student's scholarship amount.
3. In the same window, pick **TV feed** and **Comma-separated values (.csv)**, copy the link and paste it
   as `data.csvUrl` in [js/config.js](js/config.js).
   To try a sheet before switching, open the slideshow with `?csv=` plus the link at the end of the URL.

**The weekly cycle is paused for now** (`rotation.paused: true` in [js/config.js](js/config.js)): the TV plays
everyone entered so far and phases nobody out. Set it to `false` to start the Friday cycle below.

Counselors add a new group every Friday, with that Friday's date as its Rotation start. The page plays
only rows from the latest rotation date on or before today, so each Friday's group replaces the
previous one (and stays up until the next group starts). Between loops it reloads when the date changes,
and it checks the sheet every hour (`refresh.checkMinutes`) and reloads if anything changed, so a group
entered Friday afternoon is on the TV within the hour. Rows play in sheet order, except that a student's colleges are spread out (everyone's first
college, then everyone's second), a Georgia college never plays first, and the same college or
student never plays twice in a row (`order` in [js/config.js](js/config.js)). If the sheet can't be reached, it plays the last copy that loaded.

### TV feed shows #REF!
Sheets made from the template before Nov 6, 2026 point each TV feed cell at one exact row of Students,
so deleting a row there leaves `#REF!` on the TV feed (the slideshow skips those rows, and `?debug=1`
says so). To fix it for good: on the **TV feed** tab, select columns **A to G** (not H) and press Delete,
then click **A1** and paste

    =FILTER({Students!A1:F,Students!H1:H},Students!B1:B<>"")

It copies every Students row that has a student, minus the Scholarship column, and adjusts by itself
when rows are added, deleted or moved. Newer copies of the template use row-proof formulas already.

## Scholarship total
Counselors type each college's offer (from SCOIR, e.g. `40000`) in the **Scholarship** column of that
college's row on the Students tab. The TV feed tab leaves that column out and adds it up in its
**Scholarship total** column (`=SUM(Students!G2:G2000)` in H2), so the published sheet has only the sum,
never who got what. Every offer counts, including colleges the student turned down.
The finale shows "$X in scholarships offered this year" next to the commitments, whatever `totals.scope`
is set to, and hides it when the total is blank or 0. The `?debug=1` panel shows the total it read, and
warns if the published sheet has per-student amounts (meaning the Students tab was published by mistake).

## Match photos automatically
[sheet/match-photos.gs](sheet/match-photos.gs) is a small script that lives in the Google Sheet. About once an
hour, it gives every student with an empty Photo cell the photo from a Drive folder that has their name.
It never changes a Photo cell that already has something in it.

1. **Make the photo folder.** Create a folder in Google Drive, then Share → General access:
   **Anyone with the link** (Viewer). The TV isn't signed in to Google, so it can only show photos
   that anyone with the link can see. If your school account doesn't allow that, make the folder
   from a personal Gmail account and share it with your counselor as an Editor.
2. **Name each photo after the student**, the way the sheet spells them: `Jane Doe.jpg`. Capital letters,
   accents, apostrophes and word order don't matter (`DOE_JANE.JPG` and `Doe, Jane.png` work too), and photos
   in subfolders count. A nickname or middle name that the sheet doesn't have won't match.
3. **Add the script.** In the Google Sheet, choose Extensions → Apps Script. Delete what's there, paste in
   everything from `sheet/match-photos.gs`, and put the folder's link between the quotes on the
   `PHOTO_FOLDER_URL` line. Click Save.
4. **Turn it on.** Reload the sheet. A **Slideshow** menu appears: choose **Match photos every hour (turn on)**.
   Google asks for permission the first time (Continue → pick the account → Allow). If Google shows
   "Google hasn't verified this app", click Advanced → Go to (project name). That's normal for your
   own scripts.

After that, adding students is all anyone has to do. **Slideshow → Match photos now** runs it right away.
Students with no matching photo get a light blue Photo cell with a note. Add their photo to the folder, or
paste a link into the cell, and the next run fills it in or clears the note.

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
