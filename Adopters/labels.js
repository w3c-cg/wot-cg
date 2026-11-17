// Tile labels and the initials shown in place of a logo.

// Skipped for initials, e.g. "University of Bath" -> "UB".
const FILLER_WORDS = new Set(['of', 'the', 'and', 'for', 'de']);

function words(text) {
  return text.split(/[\s/]+/).filter(w => /\p{L}/u.test(w) && !FILLER_WORDS.has(w.toLowerCase()));
}

// A trailing bracket is dropped, unless it is the acronym of the name, then only that is used:
// "Industrial Digital Twin Association (IDTA)" -> "IDTA", "Bosch (Bosch.IO)" -> "Bosch"
export function tileLabel(name) {
  const match = name.match(/^(.*?)\s*\(([^()]*)\)$/);
  if (!match) return name;
  const [, main, bracket] = match;
  const acronym = words(main).map(w => w[0]).join('').toUpperCase();
  return bracket === acronym ? bracket : main;
}

// Up to two letters, e.g. "Eclipse Thingweb" -> "ET"
export function initials(label) {
  return words(label).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}
