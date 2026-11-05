"""Builds the counselors' spreadsheet: sheet/College Acceptances.xlsx

    python3 tools/make_counselor_sheet.py

To start a new sheet with students already in it (e.g. moving off an older sheet), pass its
published CSV and an output file; keep that file out of git, it has students' names:

    python3 tools/make_counselor_sheet.py --rows <csv file or link> --out sheet/private/new.xlsx

Upload it to Google Drive and open it with Google Sheets (dropdowns, the date picker and the
row colors carry over). Counselors type on the "Students" tab, which stays private because it
has each student's scholarship amount. The "TV feed" tab copies it by formula without the
amounts and adds the scholarship total; it's the only tab published for the slideshow.
"""
import argparse
import csv
import io
import json
import urllib.request
from datetime import date, datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "sheet" / "College Acceptances.xlsx"
ROWS = 2000   # rows prepared with dropdowns and colors (a whole class, several colleges each)

CRIMSON, CHARCOAL, MUTED = "9D2235", "3D4047", "6B6E75"
PINK, YELLOW, RED_SOFT, GREY = "FBE9EC", "FFF2B3", "F8D7DA", "F3F3F4"
FONT = "Arial"
HEADERS = ["Rotation start", "Student name", "College", "City", "State", "Status", "Scholarship", "Photo"]
TV_HEADERS = ["Rotation start", "Student name", "College", "City", "State", "Status", "Photo", "Scholarship total"]
STATES = ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH "
          "NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR").split()

f = lambda **kw: Font(name=FONT, **kw)
fill = lambda c: PatternFill("solid", start_color=c, end_color=c)
thin = Side(style="thin", color="D9D9DC")


def header_row(ws, row, labels, col=1):
    for i, label in enumerate(labels):
        c = ws.cell(row=row, column=col + i, value=label)
        c.font = f(bold=True, color="FFFFFF", size=11)
        c.fill = fill(CRIMSON)
        c.alignment = Alignment(vertical="center")
        c.border = Border(bottom=thin)


def college_list():
    """Names counselors pick from: the slideshow's college list, tidied for display."""
    data = json.loads((ROOT / "data" / "colleges.json").read_text())
    i = {k: n for n, k in enumerate(data["fields"])}
    seen, rows = set(), []
    for r in data["rows"]:
        name = r[i["name"]]
        for suffix in ("-Main Campus", " - Main Campus", "-Main"):
            if name.endswith(suffix):
                name = name[: -len(suffix)]
        if name.lower() in seen:
            continue
        seen.add(name.lower())
        rows.append((name, r[i["city"]], r[i["state"]]))

    # Plain names for campus names: "University of Pittsburgh-Pittsburgh Campus" is also listed as
    # "University of Pittsburgh" (its biggest campus), the way the slideshow reads it too.
    biggest = {}
    for r in data["rows"]:
        name, dash = r[i["name"]], r[i["name"]].rfind("-")
        if dash > 0 and " " in name[:dash].strip():
            base = name[:dash].strip()
            if base not in biggest or r[i["size"]] > biggest[base][0]:
                biggest[base] = (r[i["size"]], r[i["city"]], r[i["state"]])
    for base, (_, city, state) in biggest.items():
        if base.lower() not in seen:
            seen.add(base.lower())
            rows.append((base, city, state))

    # Nicknames from college-extras.json ("Georgia Tech", "Spelman") so typing them finds the
    # college too; the slideshow understands them. Bare acronyms (UGA, GT) are left out
    # because whatever is picked here is what the TV card shows.
    where = {r[i["name"]]: (r[i["city"]], r[i["state"]]) for r in data["rows"]}
    extras = json.loads((ROOT / "data" / "college-extras.json").read_text())["colleges"]
    for official, x in extras.items():
        if official not in where:
            continue
        for alias in x.get("aliases", []):
            if alias.isupper() or alias.lower() in seen:
                continue
            seen.add(alias.lower())
            rows.append((alias, *where[official]))
    return sorted(rows, key=lambda r: r[0].lower())


def read_rows(src):
    """Students from a published CSV (file or link): Rotation start, Student name, College,
    City, State, Status, Photo, matched by heading (no amounts: they're never published). City and State are left to the formulas
    unless the college isn't in the list (then the typed values are kept)."""
    text = (urllib.request.urlopen(src).read().decode("utf-8") if src.startswith("http")
            else Path(src).read_text())
    rows = list(csv.DictReader(io.StringIO(text)))
    pick = lambda r, word: next((v.strip() for k, v in r.items() if k and word in k.lower() and v), "")
    out = []
    for r in rows:
        student, college = pick(r, "student"), pick(r, "college")
        if not student and not college:
            continue
        d = pick(r, "rotation")
        if d:
            for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y"):
                try:
                    d = datetime.strptime(d, fmt).date()
                    break
                except ValueError:
                    pass
        out.append({"date": d or None, "student": student, "college": college, "city": pick(r, "city"),
                    "state": pick(r, "state"), "status": pick(r, "status"), "photo": pick(r, "photo")})
    return out


def fill_students(ws, rows, colleges):
    known = {name.lower() for name, _, _ in colleges}
    for i, r in enumerate(rows, start=2):
        ws.cell(row=i, column=1, value=r["date"])
        ws.cell(row=i, column=2, value=r["student"])
        ws.cell(row=i, column=3, value=r["college"])
        if r["college"].lower() not in known:   # not in the dropdown list: keep the typed place
            ws.cell(row=i, column=4, value=r["city"] or None).font = f(size=11)
            ws.cell(row=i, column=5, value=r["state"] or None).font = f(size=11)
        ws.cell(row=i, column=6, value=r["status"] or None)
        ws.cell(row=i, column=8, value=r["photo"] or None)


def students_tab(wb, n_colleges):
    ws = wb.active
    ws.title = "Students"
    ws.sheet_properties.tabColor = CRIMSON
    header_row(ws, 1, HEADERS)
    for col in ("D1", "E1"):   # filled in automatically: grey, not crimson
        ws[col].fill = fill("9A9CA1")
    ws.row_dimensions[1].height = 26
    ws.freeze_panes = "A2"
    for col, width in zip("ABCDEFGH", (16, 30, 48, 18, 9, 15, 16, 40)):
        ws.column_dimensions[col].width = width
    last = n_colleges + 1
    for r in range(2, ROWS + 1):
        ws.cell(row=r, column=1).number_format = "m/d/yyyy"
        ws.cell(row=r, column=7).number_format = '"$"#,##0'
        for c in range(1, 9):
            ws.cell(row=r, column=c).font = f(size=11)
        # City and State fill in from the College list as soon as a college is picked.
        # Typing over them (for a college that isn't listed) just replaces the formula.
        for c, src in ((4, "B"), (5, "C")):
            cell = ws.cell(row=r, column=c)
            cell.value = (f'=IF(TRIM($C{r})="","",IFERROR(INDEX(\'College list\'!${src}$2:${src}${last},'
                          f'MATCH(TRIM($C{r}),\'College list\'!$A$2:$A${last},0)),""))')
            cell.font = f(size=11, color=MUTED)

    rng = lambda col: f"{col}2:{col}{ROWS}"
    dates = DataValidation(type="date", operator="greaterThan",
                           formula1=str((date(2024, 12, 31) - date(1899, 12, 30)).days),
                           allow_blank=True, errorStyle="warning", showInputMessage=True, showErrorMessage=True,
                           promptTitle="Rotation start",
                           prompt="This Friday's date: the day this group starts showing on the TV (it replaces "
                                  "last week's). FIRST row of each new group only. Double-click for a calendar.",
                           errorTitle="Not a date", error="Type a date like 11/17/2026, or double-click for a calendar.")
    # Google Sheets drops a dropdown that points straight at another tab; a named range survives.
    colleges = DataValidation(type="list", formula1="CollegeNames",
                              allow_blank=True, errorStyle="warning", showInputMessage=True, showErrorMessage=True,
                              promptTitle="College", prompt="Start typing and pick the college from the list.",
                              errorTitle="Not in the college list",
                              error="Check the spelling, or pick it from the list. For a college that really "
                                    "isn't listed, type its City and State.")
    status = DataValidation(type="list", formula1='"Accepted,Committed"', allow_blank=True,
                            errorStyle="stop", showInputMessage=True, showErrorMessage=True,
                            promptTitle="Status", prompt="Accepted = got in. Committed = the student chose this "
                                                         "college. Blank counts as Accepted.",
                            errorTitle="Choose from the list", error="Pick Accepted or Committed.")
    money = DataValidation(type="decimal", operator="greaterThanOrEqual", formula1="0", allow_blank=True,
                           errorStyle="warning", showInputMessage=True, showErrorMessage=True,
                           promptTitle="Scholarship",
                           prompt="Optional. Scholarship money this college offered (from SCOIR), e.g. 40000. "
                                  "Private: the TV shows only the total for the year.",
                           errorTitle="Not an amount", error="Type a dollar amount like 40000.")
    photo = DataValidation(type="custom", formula1="TRUE", allow_blank=True, showInputMessage=True,
                           promptTitle="Photo",
                           prompt="Optional. The student's yearbook photo: in Google Drive, Share it as 'Anyone with "
                                  "the link', then Copy link and paste it here.")
    for dv, col in ((dates, "A"), (colleges, "C"), (status, "F"), (money, "G"), (photo, "H")):
        ws.add_data_validation(dv)
        dv.add(rng(col))

    whole = f"A2:H{ROWS}"
    # Same student + same college twice: probably typed twice.
    ws.conditional_formatting.add(whole, FormulaRule(
        formula=[f'AND($B2<>"",$C2<>"",COUNTIFS($B$2:$B${ROWS},$B2,$C$2:$C${ROWS},$C2)>1)'],
        fill=fill(YELLOW), stopIfTrue=True))
    # A name with no college yet.
    ws.conditional_formatting.add(f"C2:C{ROWS}", FormulaRule(formula=['AND($B2<>"",$C2="")'], fill=fill(RED_SOFT)))
    # College typed but not found in the list (City stayed empty): probably a typo.
    ws.conditional_formatting.add(f"C2:E{ROWS}", FormulaRule(formula=['AND(TRIM($C2)<>"",$D2="")'], fill=fill(RED_SOFT)))
    # Not the Photo column, so the photo script's light blue "no photo yet" color shows.
    ws.conditional_formatting.add(f"A2:G{ROWS}", FormulaRule(formula=['$F2="Committed"'], fill=fill(PINK)))
    return ws


def tv_tab(wb):
    """Published copy of Students for the slideshow: no amounts, plus the year's total.
    Formulas only, so nobody edits it; nothing else may go on this tab (it's all public)."""
    ws = wb.create_sheet("TV feed")
    ws.sheet_properties.tabColor = "9A9CA1"
    header_row(ws, 1, TV_HEADERS)
    for h in ws[1]:
        h.fill = fill("9A9CA1")
    for col, width in zip("ABCDEFGH", (16, 30, 48, 18, 9, 15, 30, 20)):
        ws.column_dimensions[col].width = width
    src = "ABCDEFH"   # Students columns copied, in order (G = the private amounts, skipped)
    for r in range(2, ROWS + 1):
        for i, c in enumerate(src, start=1):
            # Empty unless the row has a student; a blank date stays blank ("same as above").
            cell = ws.cell(row=r, column=i, value=f'=IF(OR(Students!$B{r}="",Students!{c}{r}=""),"",Students!{c}{r})')
            cell.font = f(size=10, color=MUTED)
        ws.cell(row=r, column=1).number_format = "m/d/yyyy"
    total = ws.cell(row=2, column=8, value=f"=SUM(Students!G2:G{ROWS})")
    total.number_format = '"$"#,##0'
    total.font = f(size=11, bold=True, color=CRIMSON)
    ws.freeze_panes = "A2"


def help_tab(wb):
    ws = wb.create_sheet("How to use")
    ws.sheet_properties.tabColor = CHARCOAL
    ws.sheet_view.showGridLines = False
    ws.column_dimensions["A"].width = 3
    for col, width in zip("BCDEFGHI", (24, 26, 34, 14, 8, 13, 13, 14)):
        ws.column_dimensions[col].width = width
    row = 2

    def put(text, *, size=11, bold=False, color=CHARCOAL, col=2, span=6, height=None, italic=False):
        nonlocal row
        c = ws.cell(row=row, column=col, value=text)
        c.font = f(size=size, bold=bold, color=color, italic=italic)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        if span > 1:
            ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + span - 1)
        if height:
            ws.row_dimensions[row].height = height
        row += 1

    def gap(n=1):
        nonlocal row
        row += n

    put("College Acceptances: how to use this sheet", size=18, bold=True, color=CRIMSON, height=30)
    put("Everything on the Students tab plays on the lobby TV map, except scholarship amounts: those stay private, "
        "and the TV shows only the year's total. Only edit the Students tab.", color=MUTED, height=30)
    gap()

    put("Adding students", size=13, bold=True, color=CRIMSON, height=20)
    steps = [
        "1. Go to the Students tab and start on the first empty row.",
        "2. Rotation start: each Friday, type that Friday's date on the first row of the new group only; leave it "
        "blank on the rows below. That group replaces last week's on the TV within the hour. Double-click for a calendar.",
        "3. Student name: exactly as it should appear on screen.",
        "4. College: start typing and pick it from the dropdown.",
        "5. Status: Accepted or Committed.",
        "6. Scholarship (optional): the money that college offered, from SCOIR (e.g. 40000). Private; the TV "
        "shows only the total for the year.",
        "7. Photo (optional): a Google Drive link to the student's yearbook photo (Share > Anyone with the link). "
        "Without one, the card shows the student's initials.",
        "That's it. City and State fill in by themselves (in grey) once you pick the college.",
    ]
    for s in steps:
        put(s, height=30 if len(s) > 95 else None)
    gap()

    put("Example", size=13, bold=True, color=CRIMSON, height=20)
    header_row(ws, row, HEADERS, col=2)
    row += 1
    example = [
        (date(2026, 11, 17), "Jordan Smith", "Emory University", "Atlanta", "GA", "Committed", 80000, "(Drive link)"),
        (None, "Jordan Smith", "University of Georgia", "Athens", "GA", "Accepted", 20000, "(Drive link)"),
        (None, "Taylor Brown", "Savannah College of Art and Design", "Savannah", "GA", "Accepted", None, None),
    ]
    for values in example:
        for i, v in enumerate(values):
            c = ws.cell(row=row, column=2 + i, value=v)
            c.font = f(size=11, color=CHARCOAL)
            c.fill = fill(PINK if values[5] == "Committed" else GREY)
            c.border = Border(bottom=thin)
            if i == 0:
                c.number_format = "m/d/yyyy"
            if i == 6:
                c.number_format = '"$"#,##0'
        row += 1
    put("Only the first row of the group has a date. Jordan has one row per college; the finale counts "
        "Jordan once.", color=MUTED, italic=True, height=30)
    gap()

    put("Good to know", size=13, bold=True, color=CRIMSON, height=20)
    tips = [
        ("Scholarships", "Type each college's offer in the Scholarship column of that college's row. Every offer counts "
                         "toward the year's total on the TV, including colleges the student didn't choose. The amounts "
                         "stay private: the TV feed tab leaves them out and shows only the sum."),
        ("Photos", "If the photo script is set up (Slideshow menu at the top), just drop each photo into the "
                   "photo folder named after the student, like Jane Doe.jpg; links fill in within the hour. "
                   "Light blue Photo cell = no photo found yet. Photos show on the public slideshow page, so only "
                   "add ones the student is happy to share."),
        ("Accepted vs. Committed", "Add a row for each college a student gets into (Accepted). When they decide, "
                                   "change that row's Status to Committed. Blank counts as Accepted."),
        ("College not in the list?", "Type its full name, then type over City and State. A small warning on the "
                                     "cell is fine. Colleges outside the US can't be shown (the map is US-only)."),
        ("When it shows on the TV", "On the Rotation start date: within about an hour of saving, if that date is "
                                    "today or earlier. Fixes to rows already showing also appear within the hour. "
                                    "Each week's group stays up until the next Friday's group replaces it. A future "
                                    "date waits for that day, so you can enter a group early."),
        ("Order on screen", "Rows play in the order listed, except a Georgia college never goes first and the same "
                            "college never plays twice in a row."),
        ("Please don't", "Rename, move or insert columns, add rows above the headings, or type anything on the TV "
                         "feed tab (it fills in by itself and is public). Use a different tab for notes."),
    ]
    for label, text in tips:
        a = ws.cell(row=row, column=2, value=label)
        a.font = f(size=11, bold=True, color=CHARCOAL)
        a.alignment = Alignment(wrap_text=True, vertical="top")
        b = ws.cell(row=row, column=3, value=text)
        b.font = f(size=11, color=CHARCOAL)
        b.alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=7)
        ws.row_dimensions[row].height = 44 if len(text) < 170 else 74
        row += 1
    gap()

    put("Row colors on the Students tab", size=13, bold=True, color=CRIMSON, height=20)
    for color, text in ((PINK, "Committed"), (YELLOW, "Same student and college entered twice, so check for a duplicate"),
                        (RED_SOFT, "Missing college, or a college that isn't in the list (check the spelling)")):
        ws.cell(row=row, column=2).fill = fill(color)
        ws.cell(row=row, column=2).border = Border(top=thin, bottom=thin, left=thin, right=thin)
        c = ws.cell(row=row, column=3, value=text)
        c.font = f(size=11, color=CHARCOAL)
        ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=7)
        row += 1
    gap()

    put("Checking your entries", size=13, bold=True, color=CRIMSON, height=20)
    put("Open the slideshow link with ?debug=1 added to the end. It lists every row and flags any it "
        "couldn't place on the map. Add &today=11/17/2026 to preview a future rotation.", height=30)
    gap()

    put("One-time setup (whoever runs the slideshow)", size=13, bold=True, color=CRIMSON, height=20)
    for s in [
        "1. Upload this file to Google Drive, open it, and choose File > Save as Google Sheets.",
        "2. File > Share > Publish to web > Published content & settings: tick ONLY TV feed (never Students or "
        "Entire document, which would publish the scholarship amounts), then Publish.",
        "3. In the same window, pick TV feed and Comma-separated values (.csv), copy the link and paste it as "
        "data.csvUrl in js/config.js.",
        "4. Share the Google Sheet (Editor) with the college counselors.",
    ]:
        put(s, height=30 if len(s) > 95 else None)


def colleges_tab(wb, rows):
    ws = wb.create_sheet("College list")
    ws.sheet_properties.tabColor = "9A9CA1"
    header_row(ws, 1, ["College", "City", "State"])
    ws.freeze_panes = "A2"
    ws.column_dimensions["A"].width = 60
    ws.column_dimensions["B"].width = 22
    ws.column_dimensions["C"].width = 8
    for r, values in enumerate(rows, start=2):
        for c, v in enumerate(values, start=1):
            ws.cell(row=r, column=c, value=v).font = f(size=10)
    ws.cell(row=1, column=5, value="Colleges the slideshow can place on the map (IPEDS). Used by the "
                                   "College dropdown; no need to edit.").font = f(size=10, italic=True, color=MUTED)


def main():
    ap = argparse.ArgumentParser(description="Build the counselors' College Acceptances spreadsheet.")
    ap.add_argument("--rows", help="published CSV (file or link) of students to copy into the Students tab")
    ap.add_argument("--out", type=Path, default=OUT, help="where to write the .xlsx")
    args = ap.parse_args()

    rows = college_list()
    wb = Workbook()
    wb._named_styles["Normal"].font = Font(name=FONT, size=11)
    students = students_tab(wb, len(rows))
    if args.rows:
        fill_students(students, read_rows(args.rows), rows)
    tv_tab(wb)
    help_tab(wb)
    colleges_tab(wb, rows)
    wb.defined_names["CollegeNames"] = DefinedName("CollegeNames", attr_text=f"'College list'!$A$2:$A${len(rows) + 1}")
    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out)
    print(f"Wrote {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out} ({len(rows)} colleges in the dropdown)")


if __name__ == "__main__":
    main()
