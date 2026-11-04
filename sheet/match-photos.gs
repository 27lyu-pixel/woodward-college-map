/**
 * Fills in the Students tab's Photo column from a Google Drive folder of senior photos.
 *
 * Name each photo after the student, the way they're written in the sheet:
 *   "Jane Doe.jpg" (also fine: "jane doe.JPG", "Doe, Jane.png", "Doe_Jane.jpeg")
 * Every row with a student name and an empty Photo cell gets the matching photo's link.
 * A Photo cell that already has something in it is never changed.
 * Students with no matching photo get a light blue Photo cell with a note saying so.
 *
 * Setup (once): see "Match photos automatically" in the project README.
 * Paste the photo folder's link below, then use the "Slideshow" menu in the sheet.
 */

const PHOTO_FOLDER_URL = "PASTE THE PHOTO FOLDER LINK HERE";
const SHEET_NAME = "Students";
const MISSING_COLOR = "#e3eefc";   // Photo cell color when no photo matches

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Slideshow")
    .addItem("Match photos now", "matchPhotosNow")
    .addItem("Match photos every hour (turn on)", "turnOnHourly")
    .addItem("Stop matching every hour", "turnOffHourly")
    .addToUi();
}

// "Doe, Jane" / "Jane  Doe" / "doe_jane" / "Jáne Doe (1)" -> "doe jane"; "O'Brien" -> "obrien"
// Word order doesn't matter, so "Last First" file names match "First Last" in the sheet.
function nameKey(text) {
  return String(text || "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")       // file extension
    .replace(/\s*\(\d+\)$/, "")              // " (1)" from duplicate uploads
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // accents
    .replace(/['’]/g, "")               // apostrophes: O'Brien = OBrien
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    .split(" ").filter(Boolean).sort().join(" ");
}

function folderFromUrl(url) {
  const m = String(url).match(/folders\/([\w-]{10,})|[?&]id=([\w-]{10,})/);
  if (!m) throw new Error("Paste the photo folder's link into PHOTO_FOLDER_URL at the top of the script.");
  return DriveApp.getFolderById(m[1] || m[2]);
}

// name key -> newest image file with that name (subfolders included)
function photosByName(folder) {
  const found = new Map();
  const walk = f => {
    const files = f.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (!String(file.getMimeType()).startsWith("image/")) continue;
      const key = nameKey(file.getName());
      const prev = found.get(key);
      if (key && (!prev || file.getLastUpdated() > prev.getLastUpdated())) found.set(key, file);
    }
    const subs = f.getFolders();
    while (subs.hasNext()) walk(subs.next());
  };
  walk(folder);
  return found;
}

function matchPhotos() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`No tab named "${SHEET_NAME}".`);
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).toLowerCase());
  const studentCol = headers.findIndex(h => h.includes("student")) + 1;
  const photoCol = headers.findIndex(h => h.includes("photo")) + 1;
  if (!studentCol) throw new Error('No "Student name" column found.');
  if (!photoCol) throw new Error('No "Photo" column found. Type Photo in the first empty heading cell.');
  if (lastRow < 2) return { filled: 0, missing: [] };

  // Read everything in a few calls (the sheet has ~1000 prepared rows), write back only changes.
  const n = lastRow - 1;
  const students = sheet.getRange(2, studentCol, n, 1).getValues().map(r => String(r[0]).trim());
  const photoRange = sheet.getRange(2, photoCol, n, 1);
  const links = photoRange.getValues().map(r => String(r[0]).trim());
  const notes = photoRange.getNotes().map(r => r[0]);
  const colors = photoRange.getBackgrounds().map(r => r[0]);
  const newNotes = notes.slice(), newColors = colors.slice();
  const ours = i => notes[i].startsWith("No photo");   // a note this script left

  const photos = photosByName(folderFromUrl(PHOTO_FOLDER_URL));
  let filled = 0;
  const missing = [];
  students.forEach((student, i) => {
    const clear = () => { if (ours(i)) { newNotes[i] = ""; newColors[i] = "#ffffff"; } };
    if (links[i] || !student) return clear();            // has a photo already, or an empty row
    const file = photos.get(nameKey(student));
    if (file) {
      // The TV isn't signed in, so the photo must be viewable by anyone with the link.
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      sheet.getRange(i + 2, photoCol).setValue(file.getUrl());
      filled++;
      clear();
    } else {
      newNotes[i] = `No photo named "${student}" in the photo folder yet. Add one, or paste a link here.`;
      newColors[i] = MISSING_COLOR;
      missing.push(student);
    }
  });
  if (newNotes.some((x, i) => x !== notes[i])) photoRange.setNotes(newNotes.map(x => [x]));
  if (newColors.some((x, i) => x !== colors[i])) photoRange.setBackgrounds(newColors.map(x => [x]));
  return { filled, missing: [...new Set(missing)] };
}

function matchPhotosNow() {
  const { filled, missing } = matchPhotos();
  SpreadsheetApp.getUi().alert(
    `Added ${filled} photo${filled === 1 ? "" : "s"}.` +
    (missing.length ? `\n\nNo photo yet for: ${missing.join(", ")}` : ""));
}

function turnOnHourly() {
  turnOffHourly();
  ScriptApp.newTrigger("matchPhotos").timeBased().everyHours(1).create();
  matchPhotosNow();
}

function turnOffHourly() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "matchPhotos")
    .forEach(t => ScriptApp.deleteTrigger(t));
}
