// Tile labels and logo initials derived from adopter names. No DOM access.

/**
 * Splits off a trailing "(...)":
 *   "Industrial Digital Twin Association (IDTA)"  ->  { main: "Industrial Digital Twin Association", bracket: "IDTA" }
 *   "Siemens"                                     ->  { main: "Siemens", bracket: null }
 */
function splitTrailingBracket(text) {
  const match = text.match(/^(.*?)\s*\(([^()]*)\)$/);
  return match ? { main: match[1], bracket: match[2] } : { main: text, bracket: null };
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
