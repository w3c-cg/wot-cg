#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

// Newest 3 get a thumbnail card, the rest are collapsed.
const LATEST_COUNT = 3;

function formatDate(dateStr) {
  const [d, m, y] = String(dateStr).split('-');
  const month = MONTHS[parseInt(m, 10) - 1];
  if (!month || !Number.isInteger(parseInt(d, 10))) return String(dateStr);
  return `${parseInt(d, 10)} ${month} ${y}`;
}

function formatSpeakers(speakers) {
  return speakers
    .map(s => s.organisation ? `${s.name} - ${s.organisation}` : s.name)
    .join(', ');
}

function presenterLabel(speakers) {
  return speakers.length > 1 ? 'Presenters' : 'Presenter';
}

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

function introSlideLinks(folder, intro) {
  if (!intro) return [];
  const links = [];
  if (intro.google_slides) links.push(`[Google Slides](${intro.google_slides})`);
  if (intro.pdf) links.push(`[PDF](./${folder}/${intro.pdf})`);
  return links;
}

function cellSafe(text) {
  return String(text)
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, '<br><br>');
}

function blockText(text) {
  return String(text).replace(/\n+/g, '\n\n');
}

function details(summary, body, inTable) {
  return inTable
    ? `<details><summary>${summary}</summary><br>${body}</details>`
    : `<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`;
}

function descriptionBlock(data, inTable) {
  if (!data.description) return null;
  const body = inTable ? cellSafe(data.description) : blockText(data.description);
  return details('Description', body, inTable);
}

// One collapsible bio per speaker. Falls back to a single line if nobody has one.
function speakerLines(speakers, inTable) {
  const label = presenterLabel(speakers);

  if (!speakers.some(s => s.bio)) {
    const joined = formatSpeakers(speakers);
    return inTable
      ? [`**${label}:** ${cellSafe(joined)}`]
      : [`- ${label}: ${joined}`];
  }

  const nameOf = s => (s.organisation ? `${s.name} - ${s.organisation}` : s.name);

  if (inTable) {
    const parts = speakers.map(s => {
      const who = cellSafe(nameOf(s));
      return s.bio ? `${who} ${details('Bio', cellSafe(s.bio), true)}` : who;
    });
    return [`**${label}:**`, ...parts];
  }

  const lines = [`- ${label}:`];
  for (const s of speakers) {
    lines.push(`  - ${nameOf(s)}`);
    if (s.bio) lines.push(`    ${details('Bio', s.bio, true)}`);
  }
  return lines;
}

// Bullet list, used for the older meetups.
function generateSection(folder, data) {
  const lines = [`## Meetup ${data.meetup}`, ''];

  lines.push(`- Name: ${data.title}`);

  if (data.speakers?.length > 0) {
    lines.push(...speakerLines(data.speakers, false));
  }

  lines.push(`- Date: ${formatDate(data.date)}`);

  for (const link of presenterSlideLinks(folder, data.presenter_slides)) {
    lines.push(`- ${link}`);
  }

  const introLinks = introSlideLinks(folder, data.intro_slides);
  if (introLinks.length > 0) lines.push(`- Intro Slides: ${introLinks.join(' | ')}`);

  lines.push(data.youtube_url ? `- [Video](${data.youtube_url})` : '- No Video Available');

  if (data.minutes) lines.push(`- [Minutes](./${folder}/${data.minutes})`);
  if (data.w3c_event_link) lines.push(`- [W3C Event Page](${data.w3c_event_link})`);

  const description = descriptionBlock(data, false);
  if (description) lines.push('', description);

  lines.push('');
  return lines.join('\n');
}

// Table row with the thumbnail, used for the newest meetups.
function generateCard(folder, data) {
  const thumb = data.thumbnail
    ? `![${data.title}](./${folder}/${data.thumbnail})`
    : '_No thumbnail_';
  const thumbCell = data.youtube_url ? `[${thumb}](${data.youtube_url})` : thumb;

  const detail = [`**${cellSafe(data.title)}**`];

  if (data.speakers?.length > 0) {
    detail.push(...speakerLines(data.speakers, true));
  }

  detail.push(`**Date:** ${formatDate(data.date)}`);

  const links = [];
  if (data.youtube_url) links.push(`[Video](${data.youtube_url})`);
  links.push(...presenterSlideLinks(folder, data.presenter_slides));
  links.push(...introSlideLinks(folder, data.intro_slides));
  if (data.minutes) links.push(`[Minutes](./${folder}/${data.minutes})`);
  if (data.w3c_event_link) links.push(`[W3C Event Page](${data.w3c_event_link})`);
  if (links.length > 0) detail.push(links.join(' • '));

  const description = descriptionBlock(data, true);
  if (description) detail.push(description);

  return `| ${thumbCell} | ${detail.join('<br>')} |`;
}

// Strip what we generated last time, otherwise re-running duplicates it.
function stripGeneratedWrappers(content) {
  return content
    .replace(/\n?## Latest Meetups\n\n(?:\|[^\n]*\n)*\n?/, '\n')
    .replace(/\n?<details>\n<summary>[^\n]*<\/summary>\n\n/, '\n')
    .replace(/\n?<\/details>\n?/, '\n');
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

const { header, sections } = parseReadme(fs.readFileSync(readmePath, 'utf8'));

// Only meetups with a metadata.yaml.
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

// One shared table for the cards. A meetup without a yaml closes the table
// and falls back to its bullet section.
let tableOpen = false;
for (const num of latestNums) {
  if (meetups[num]) {
    if (!tableOpen) {
      newContent += '| | |\n|---|---|\n';
      tableOpen = true;
    }
    newContent += generateCard(meetups[num].folder, meetups[num].data) + '\n';
  } else {
    if (tableOpen) {
      newContent += '\n';
      tableOpen = false;
    }
    newContent += sections[num].trimEnd() + '\n\n';
  }
}
if (tableOpen) newContent += '\n';

if (olderNums.length > 0) {
  newContent += `<details>\n<summary>Show ${olderNums.length} older meetup(s)</summary>\n\n`;
  for (const num of olderNums) {
    newContent += sections[num].trimEnd() + '\n\n';
  }
  newContent += '</details>\n';
}

fs.writeFileSync(readmePath, newContent.trimEnd() + '\n', 'utf8');
console.log(`\nUpdated Meetups/Readme.md (${updated.length} section(s) regenerated from metadata.yaml)`);
