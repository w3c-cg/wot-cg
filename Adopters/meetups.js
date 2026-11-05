// Loads meetup details (title, date, video link) from Meetups/<folder>/metadata.yaml
// on the main branch.

const RAW_FILES_URL = 'https://raw.githubusercontent.com/w3c-cg/wot-cg/main/Meetups/';
const FOLDER_PAGE_URL = 'https://github.com/w3c-cg/wot-cg/tree/main/Meetups/';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Folder names: "0", "01" to "09", then "10" onwards.
function folderName(number) {
  return number === 0 ? '0' : String(number).padStart(2, '0');
}

/** GitHub URL of the meetup folder, used as the fallback link. */
export function meetupFolderUrl(number) {
  return FOLDER_PAGE_URL + folderName(number);
}

/**
 * Returns the value of a single-line `key: value` entry. Supports double-quoted,
 * single-quoted and plain values, which the meetup validator all allows.
 * Empty, `null` and `~` return null. Not a general YAML parser.
 */
function readYamlValue(yaml, key) {
  const line = yaml.match(new RegExp(String.raw`^${key}:[ \t]*(.*?)[ \t]*\r?$`, 'm'));
  if (!line) return null;
  const value = line[1];

  const doubleQuoted = value.match(/^"((?:[^"\\]|\\.)*)"/);
  if (doubleQuoted) return JSON.parse(`"${doubleQuoted[1]}"`);   // JSON-compatible escapes

  const singleQuoted = value.match(/^'((?:[^']|'')*)'/);
  if (singleQuoted) return singleQuoted[1].replace(/''/g, "'");  // '' is an escaped quote

  const plain = value.replace(/\s+#.*$/, '');                     // strip trailing comment
  return plain === '' || plain === 'null' || plain === '~' ? null : plain;
}

/** Formats a DD-MM-YYYY date, e.g. "16-10-2025" -> "Oct 2025". */
export function formatMonth(date) {
  const [, month, year] = (date ?? '').split('-');
  const name = MONTHS[Number(month) - 1];
  return name && year ? `${name} ${year}` : '';
}

// Pending or completed requests by meetup number, so each file is fetched once.
const cache = new Map();

/**
 * Resolves to { title, date, url }, or null if the file can't be loaded
 * (offline, or the meetup isn't on main yet). Never rejects.
 */
export function loadMeetup(number) {
  if (!cache.has(number)) {
    const request = fetch(`${RAW_FILES_URL}${folderName(number)}/metadata.yaml`)
      .then(response => (response.ok ? response.text() : Promise.reject()))
      .then(yaml => ({
        title: readYamlValue(yaml, 'title'),
        date: readYamlValue(yaml, 'date'),
        url: readYamlValue(yaml, 'youtube_url') ?? readYamlValue(yaml, 'w3c_event_link'),
      }))
      .catch(() => null);
    cache.set(number, request);
  }
  return cache.get(number);
}
