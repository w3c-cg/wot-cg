#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('../Tutorials/whatiswot/website/node_modules/js-yaml');

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

function formatDate(dateStr) {
  try {
    const [d, m, y] = String(dateStr).split('-');
    return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
  } catch {
    return String(dateStr);
  }
}

function formatSpeakers(speakers) {
  return speakers
    .map(s => s.organisation ? `${s.name} - ${s.organisation}` : s.name)
    .join(', ');
}

function generateSection(num, data) {
  const lines = [`## Meetup ${num}`, ''];

  lines.push(`- Name: ${data.title}`);

  if (data.speakers?.length > 0) {
    lines.push(`- Presenter(s): ${formatSpeakers(data.speakers)}`);
  }

  lines.push(`- Date: ${formatDate(data.date)}`);

  for (const slide of data.presenter_slides ?? []) {
    const label = slide.label ?? 'Presenter Slides';
    lines.push(`- [${label}](./${num}/${slide.file})`);
  }

  const intro = data.intro_slides;
  if (intro) {
    const parts = [];
    if (intro.google_slides) parts.push(`[Google Slides](${intro.google_slides})`);
    if (intro.pdf) parts.push(`[PDF](./${num}/${intro.pdf})`);
    if (parts.length > 0) lines.push(`- Intro Slides: ${parts.join(' | ')}`);
  }

  lines.push(data.youtube_url ? `- [Video](${data.youtube_url})` : '- No Video Available');

  if (data.minutes) lines.push(`- [Minutes](./${num}/${data.minutes})`);

  lines.push('');
  return lines.join('\n');
}

function parseReadme(content) {
  const parts = content.split(/\n(?=## Meetup )/);
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

const updated = [];
for (const entry of fs.readdirSync(meetupsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory()) continue;
  const yamlPath = path.join(meetupsDir, entry.name, 'metadata.yaml');
  if (!fs.existsSync(yamlPath)) continue;

  const data = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
  sections[data.meetup] = generateSection(data.meetup, data);
  updated.push(data.meetup);
  console.log(`Generated section for Meetup ${data.meetup}`);
}

if (updated.length === 0) {
  console.log('No metadata.yaml files found — README unchanged.');
  process.exit(0);
}

let newContent = header;
for (const num of Object.keys(sections).map(Number).sort((a, b) => b - a)) {
  newContent += '\n' + sections[num].trimEnd() + '\n';
}

fs.writeFileSync(readmePath, newContent.trimEnd() + '\n', 'utf8');
console.log(`\nUpdated Meetups/Readme.md (${updated.length} section(s) regenerated from metadata.yaml)`);
