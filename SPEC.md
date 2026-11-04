Project: looping animated college acceptance slideshow for Woodward Academy (College Park, GA). It plays full screen on a lobby TV in a browser.

STEP 0: Save this entire message as SPEC.md in the project root. Future sessions will read SPEC.md instead of this prompt.

LOOP
1. Title (5s): "Where are our senior War Eagles headed?" Eddy the Eagle (school mascot) perches on the title, then takes off.
2. Home base (4s): close-up map of College Park with a pin on Woodward Academy. Eddy circles once, then the map zooms out to the full US.
3. Student flights (6-7s each): Eddy flies along a curved dotted trail to each student's college, in the exact row order of the list. He lands, a student card slides in (student name, college name, college color bar), holds 3s, then he takes off for the next row. Repeat colleges are fine: each row gets its own landing. If two consecutive rows share a college, Eddy does a short hop and relands on the same pin.
4. Finale (6s): Eddy flies home to Woodward. Map shows his single continuous trail across every stop, plus totals (students, colleges, states) for the current batch. Make the totals scope a config flag: "batch" (default) or "season".
5. Loop back to title.

Eddy faces his direction of travel (flip horizontally when flying west). Use a placeholder eagle SVG for now with 2-3 wing frames; I will swap in official artwork later.

DATA
Google Sheet published as CSV. Columns: Rotation start | Student name | College | City | State.
Bi-weekly rotation: the page plays only rows from the most recent "Rotation start" date that is on or before today. Rows play in sheet order.
College coordinates come from a local lookup table built from IPEDS data (college name -> lat/long). Flag any college name that fails to match instead of crashing.
Use a local sample CSV with 5 fake students until I provide the sheet URL.

STACK
Plain HTML/CSS/JS, D3.js for the map, US states TopoJSON. No frameworks, no API keys, no paid services. Hosted on GitHub Pages. Auto-refresh once a day so rotation changes load. Woodward colors as CSS variables so I can adjust them.

BUILD ORDER (one step at a time, I test each before the next)
1. Map with Woodward pin and College Park to US zoom
2. Eddy flying between two hardcoded points
3. Student card reveal on landing
4. CSV loading + rotation date filter + college lookup
5. Finale trail and totals
6. Title slide and full loop

RULES
Plan first. Show me the file structure and the approach for step 1 only, wait for my approval, then build step 1. Do not start step 2 until I confirm step 1 works. Keep replies short.
