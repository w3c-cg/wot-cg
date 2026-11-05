// Parsing and formatting of adopters.csv data. No DOM access.

/**
 * Parses CSV text into one object per row, keyed by the header row:
 *   "Name,Type\nSiemens,Company"  ->  [{ Name: 'Siemens', Type: 'Company' }]
 *
 * Quoted cells may contain commas, line breaks and escaped quotes ("").
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (insideQuotes) {
      if (char === '"' && next === '"') { cell += '"'; i++; }   // escaped quote
      else if (char === '"') insideQuotes = false;              // end of quoted cell
      else cell += char;
    } else if (char === '"') {
      insideQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i++;                  // CRLF
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);

  const [header, ...dataRows] = rows.filter(r => r.some(c => c.trim() !== ''));
  return dataRows.map(r =>
    Object.fromEntries(header.map((name, col) => [name.trim(), (r[col] ?? '').trim()])));
}

/**
 * Splits off a trailing "(...)":
 *   "UA Edge Translator (OPC UA WoT Connectivity)"  ->  { main: "UA Edge Translator", bracket: "OPC UA WoT Connectivity" }
 *   "Siemens"                                       ->  { main: "Siemens", bracket: null }
 */
function splitTrailingBracket(text) {
  const match = text.match(/^(.*?)\s*\(([^()]*)\)$/);
  return match ? { main: match[1], bracket: match[2] } : { main: text, bracket: null };
}

/**
 * Parses the "What they did with WoT" column. Projects are separated by ";",
 * and a trailing "(...)" is the description:
 *   "UA Edge Translator (OPC UA WoT Connectivity); WoT gateway"
 *   -> [{ title: "UA Edge Translator", description: "OPC UA WoT Connectivity" },
 *       { title: "WoT gateway", description: null }]
 */
export function parseProjects(text) {
  return text
    .split(';')
    .map(item => item.trim())
    .filter(item => item !== '')
    .map(item => {
      const { main, bracket } = splitTrailingBracket(item);
      return { title: main, description: bracket };
    });
}

/**
 * Extracts meetup numbers from the Evidence column:
 *   "TD 1.1 report; Meetups 12, 24, 33"  ->  [12, 24, 33]
 */
export function parseMeetupNumbers(evidence) {
  const numbers = new Set();
  for (const match of evidence.matchAll(/Meetups?\s+(\d+(?:\s*,\s*\d+)*)/g)) {
    for (const n of match[1].split(',')) numbers.add(Number(n));
  }
  return [...numbers].sort((a, b) => a - b);
}

// Words skipped when building initials, e.g. "University of Bath" -> "UB".
const FILLER_WORDS = new Set(['of', 'the', 'and', 'for', 'de']);

function significantWords(text) {
  return text
    .split(/[\s/]+/)
    .filter(word => /\p{L}/u.test(word) && !FILLER_WORDS.has(word.toLowerCase()));
}

/**
 * Returns the tile label. A trailing acronym that matches the name replaces it;
 * any other trailing bracket is removed:
 *   "Industrial Digital Twin Association (IDTA)"  ->  "IDTA"
 *   "Bosch (Bosch.IO)"                            ->  "Bosch"
 */
export function tileLabel(name) {
  const { main, bracket } = splitTrailingBracket(name);
  const acronym = significantWords(main).map(word => word[0]).join('').toUpperCase();
  return bracket === acronym ? bracket : main;
}

/**
 * Returns up to two initials for the logo placeholder:
 *   "Eclipse Thingweb"  ->  "ET",   "Siemens"  ->  "S"
 */
export function initials(label) {
  return significantWords(label).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
}
