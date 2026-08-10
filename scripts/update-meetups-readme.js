#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

// Newest few get a big thumbnail card; the rest are collapsed with a small one.
const LATEST_COUNT = 3;
const CARD_IMG_WIDTH = 400;
const OLDER_IMG_WIDTH = 253;

function formatDate(dateStr) {
  const [d, m, y] = String(dateStr).split('-');
  const month = MONTHS[parseInt(m, 10) - 1];
  if (!month || !Number.isInteger(parseInt(d, 10))) return String(dateStr);
  return `${parseInt(d, 10)} ${month} ${y}`;
}

// "Name - Org", or just "Name" when organisation is null.
function nameOf(s) { return s.organisation ? `${s.name} - ${s.organisation}` : s.name; }

function presenterLabel(speakers) { return speakers.length > 1 ? 'Presenters' : 'Presenter'; }

// ----- older meetups: plain markdown bullet section -----

// A deck can be a local file, an online url, or both.
function presenterSlideLinks(folder, slides) {
  if (!slides || slides.length === 0) return [];
  return slides.map(s => {
    const label = s.label ? `Presenter Slides - ${s.label}` : 'Presenter Slides';
    if (!s.file) return `[${label}](${s.url})`;
    const local = `[${label}](./${folder}/${s.file})`;
    return s.url ? `${local} ([Online Version](${s.url}))` : local;
  });
}

// Intro slides bundled onto one line so they read as one thing.
function introSlideLine(folder, intro) {
  if (!intro) return null;
  const parts = [];
  if (intro.google_slides) parts.push(`[Google Slides](${intro.google_slides})`);
  if (intro.pdf) parts.push(`[PDF](./${folder}/${intro.pdf})`);
  return parts.length ? `- Intro Slides: ${parts.join(' | ')}` : null;
}

function blockText(text) { return String(text).replace(/\n+/g, '\n\n'); }

function speakerLinesMd(speakers) {
  const label = presenterLabel(speakers);
  if (!speakers.some(s => s.bio)) {
    return [`- ${label}: ${speakers.map(nameOf).join(', ')}`];
  }
  const lines = [`- ${label}:`];
  for (const s of speakers) {
    lines.push(`  - ${nameOf(s)}`);
    if (s.bio) lines.push(`    <details><summary>Bio</summary><br>${s.bio}</details>`);
  }
  return lines;
}

function generateSection(folder, data) {
  const lines = [`## Meetup ${data.meetup}`, ''];

  // Small thumbnail floated to the right of the bullet list.
  if (data.thumbnail) {
    const img = `<img src="./${folder}/${data.thumbnail}" width="${OLDER_IMG_WIDTH}" align="right" alt="${htmlEsc(data.title)}">`;
    lines.push(data.youtube_url ? `<a href="${data.youtube_url}">${img}</a>` : img, '');
  }

  lines.push(`- Name: ${data.title}`);
  if (data.speakers?.length > 0) lines.push(...speakerLinesMd(data.speakers));
  lines.push(`- Date: ${formatDate(data.date)}`);
  for (const link of presenterSlideLinks(folder, data.presenter_slides)) lines.push(`- ${link}`);
  const intro = introSlideLine(folder, data.intro_slides);
  if (intro) lines.push(intro);
  lines.push(data.youtube_url ? `- [Video](${data.youtube_url})` : '- No Video Available');
  if (data.minutes) lines.push(`- [Minutes](./${folder}/${data.minutes})`);
  if (data.w3c_event_link) lines.push(`- [W3C Event Page](${data.w3c_event_link})`);

  if (data.description) {
    lines.push('', `<details>\n<summary>Description</summary>\n\n${blockText(data.description)}\n\n</details>`);
  }

  lines.push('');
  return lines.join('\n');
}

// ----- latest meetups: HTML card (no empty header row, sized image) -----

function htmlEsc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');   // needed for values that land in alt="..."
}
function htmlText(s) { return htmlEsc(s).replace(/\n+/g, '<br><br>'); }
function aTag(text, url) { return `<a href="${url}">${htmlEsc(text)}</a>`; }

function cardSpeakers(speakers) {
  const items = speakers.map(s => {
    const who = htmlEsc(nameOf(s));
    return s.bio ? `${who} <details><summary>Bio</summary><br>${htmlText(s.bio)}</details>` : who;
  });
  return `<b>${presenterLabel(speakers)}:</b> ${items.join(', ')}`;
}

function cardLinks(folder, data) {
  const parts = [];
  if (data.youtube_url) parts.push(aTag('Video', data.youtube_url));
  for (const s of data.presenter_slides ?? []) {
    const label = s.label ? `Presenter Slides - ${s.label}` : 'Presenter Slides';
    const url = s.file ? `./${folder}/${encodeURIComponent(s.file)}` : s.url;
    if (url) parts.push(aTag(label, url));
  }
  // Intro slides bundled into one entry.
  const intro = data.intro_slides ?? {};
  const introParts = [];
  if (intro.google_slides) introParts.push(aTag('Google Slides', intro.google_slides));
  if (intro.pdf) introParts.push(aTag('PDF', `./${folder}/${encodeURIComponent(intro.pdf)}`));
  if (introParts.length) parts.push(`Intro Slides: ${introParts.join(' | ')}`);
  if (data.minutes) parts.push(aTag('Minutes', `./${folder}/${encodeURIComponent(data.minutes)}`));
  if (data.w3c_event_link) parts.push(aTag('W3C Event Page', data.w3c_event_link));
  return parts.join(' • ');
}

function generateCard(folder, data) {
  const imgInner = data.thumbnail
    ? `<img src="./${folder}/${encodeURIComponent(data.thumbnail)}" width="${CARD_IMG_WIDTH}" alt="${htmlEsc(data.title)}">`
    : '<em>No thumbnail</em>';
  const thumb = data.youtube_url ? `<a href="${data.youtube_url}">${imgInner}</a>` : imgInner;

  const detail = [`<b>${htmlEsc(data.title)}</b>`, '<br><br>'];       // title, then a gap
  if (data.speakers?.length > 0) detail.push(cardSpeakers(data.speakers), '<br>');
  detail.push(`<b>Date:</b> ${formatDate(data.date)}`, '<br><br>');
  detail.push(cardLinks(folder, data));
  if (data.description) {
    detail.push('<br><br>', `<details><summary>Description</summary><br>${htmlText(data.description)}</details>`);
  }

  return `<tr>\n<td width="${CARD_IMG_WIDTH + 40}">${thumb}</td>\n<td>${detail.join('\n')}</td>\n</tr>`;
}

// ----- read / regenerate -----

// Strip what we generated last time so re-running doesn't duplicate it. The
// "Latest Meetups" block is removed up to the older-meetups wrapper (or the
// first section) regardless of whether it was the old markdown table or the
// new HTML one, so the format transition is handled too.
function stripGeneratedWrappers(content) {
  return content
    .replace(/\n?## Latest Meetups[\s\S]*?(?=\n<details>\n<summary>Show \d+ older|\n## Meetup |$)/, '\n')
    .replace(/\n?<details>\n<summary>Show \d+ older meetup\(s\)<\/summary>\n\n/, '\n')
    .replace(/\n?<\/details>\n?$/, '\n');
}

function parseReadme(content) {
  const parts = stripGeneratedWrappers(content).split(/\n(?=## Meetup )/);
  const header = parts[0];
  const sections = {};
  for (const part of parts.slice(1)) {
    const match = part.match(/^## Meetup (\d+)/);
    if (match) sections[parseInt(match[1])] = part;
  }
  return { header, sections };
}

const meetupsDir = path.join(__dirname, '..', 'Meetups');
const readmePath = path.join(meetupsDir, 'Readme.md');

// Normalise to LF so the strip/parse regexes behave the same on Windows
// (CRLF) checkouts; the file is rewritten with LF endings.
const { header, sections } = parseReadme(fs.readFileSync(readmePath, 'utf8').replace(/\r\n/g, '\n'));

// Only meetups with a metadata.yaml. Meetup 9 has none, so its text is kept.
const meetups = {};

const updated = [];
for (const entry of fs.readdirSync(meetupsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  const yamlPath = path.join(meetupsDir, entry.name, 'metadata.yaml');
  if (!fs.existsSync(yamlPath)) continue;

  const data = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
  meetups[data.meetup] = { data, folder: entry.name };
  sections[data.meetup] = generateSection(entry.name, data);
  updated.push(data.meetup);
  console.log(`Generated section for Meetup ${data.meetup}`);
}

if (updated.length === 0) {
  console.log('No metadata.yaml files found — README unchanged.');
  process.exit(0);
}

const allNums = Object.keys(sections).map(Number).sort((a, b) => b - a);
const latestNums = allNums.slice(0, LATEST_COUNT);
const olderNums = allNums.slice(LATEST_COUNT);

let newContent = header.trimEnd() + '\n\n## Latest Meetups\n\n';

// Cards for meetups with a yaml go in one shared table; a meetup without one
// closes the table and falls back to its bullet section.
let tableOpen = false;
for (const num of latestNums) {
  if (meetups[num]) {
    if (!tableOpen) { newContent += '<table>\n'; tableOpen = true; }
    newContent += generateCard(meetups[num].folder, meetups[num].data) + '\n';
  } else {
    if (tableOpen) { newContent += '</table>\n\n'; tableOpen = false; }
    newContent += sections[num].trimEnd() + '\n\n';
  }
}
if (tableOpen) newContent += '</table>\n\n';

if (olderNums.length > 0) {
  newContent += `<details>\n<summary>Show ${olderNums.length} older meetup(s)</summary>\n\n`;
  for (const num of olderNums) newContent += sections[num].trimEnd() + '\n\n';
  newContent += '</details>\n';
}

fs.writeFileSync(readmePath, newContent.trimEnd() + '\n', 'utf8');
console.log(`\nUpdated Meetups/Readme.md (${updated.length} section(s) regenerated from metadata.yaml)`);
