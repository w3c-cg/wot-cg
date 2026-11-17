// Meetup title, date and video link, read from Meetups/<nn>/metadata.yaml on main.

import { load as parseYaml } from './vendor/js-yaml.mjs';

const RAW_URL = 'https://raw.githubusercontent.com/w3c-cg/wot-cg/main/Meetups/';
const FOLDER_URL = 'https://github.com/w3c-cg/wot-cg/tree/main/Meetups/';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Folders are "0", "01" to "09", then "10" onwards.
function folderName(number) {
  return number === 0 ? '0' : String(number).padStart(2, '0');
}

export function meetupFolderUrl(number) {
  return FOLDER_URL + folderName(number);
}

// "16-10-2025" -> "Oct 2025"
export function formatMonth(date) {
  const [, month, year] = String(date ?? '').split('-');
  const name = MONTHS[Number(month) - 1];
  return name && year ? `${name} ${year}` : '';
}

// One request per meetup.
const cache = new Map();

// Resolves to { title, date, url }, or null if the file can't be loaded.
export function loadMeetup(number) {
  if (!cache.has(number)) {
    cache.set(number, fetch(`${RAW_URL}${folderName(number)}/metadata.yaml`)
      .then(res => (res.ok ? res.text() : Promise.reject()))
      .then(text => {
        const data = parseYaml(text);
        return { title: data.title, date: data.date, url: data.youtube_url ?? data.w3c_event_link };
      })
      .catch(() => null));
  }
  return cache.get(number);
}
