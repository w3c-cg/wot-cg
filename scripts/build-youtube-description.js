#!/usr/bin/env node
'use strict';

// Generate each meetup's full YouTube description (the prose from metadata.yaml
// plus the resource links) and write it back into the same metadata.yaml as a
// `youtube_description` field. This runs in the PR, so the exact text that will
// be posted is visible and reviewable on GitHub. update-youtube.js then just
// pushes that field - it does no text building.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const REPO_BASE = 'https://github.com/w3c-cg/wot-cg/blob/main/Meetups';
const HEADING = 'Useful Links:';
const FIELD = 'youtube_description';

const fileUrl = (folder, file) => `${REPO_BASE}/${folder}/${encodeURIComponent(file)}`;

function linkLines(folder, data) {
  const lines = [];

  for (const s of data.presenter_slides ?? []) {
    const tag = s.label ? `Presenter slides (${s.label})` : 'Presenter slides';
    if (s.file) lines.push(`${tag}: ${fileUrl(folder, s.file)}`);
    else if (s.url) lines.push(`${tag}: ${s.url}`);
  }

  // One intro-slides link - prefer the live Google Slides, else the PDF.
  const intro = data.intro_slides ?? {};
  if (intro.google_slides) lines.push(`Intro slides: ${intro.google_slides}`);
  else if (intro.pdf) lines.push(`Intro slides: ${fileUrl(folder, intro.pdf)}`);

  if (data.minutes) lines.push(`Minutes: ${fileUrl(folder, data.minutes)}`);

  return lines;
}

// Full description = the YAML prose, then the links block.
function buildDescription(folder, data) {
  const parts = [];
  if (data.description) parts.push(String(data.description).trim());
  const links = linkLines(folder, data);
  if (links.length) parts.push([HEADING, ...links].join('\n'));
  return parts.join('\n\n');
}

// The generated field is always kept last in the file. Strip any existing one
// (a `youtube_description: |` literal block at the end) so regeneration is
// idempotent and never touches the hand-written fields above it.
const FIELD_BLOCK = new RegExp(`\\n*${FIELD}: \\|\\n(?:(?: {2}[^\\n]*)?\\n)*$`);

function stripField(text) {
  return text.replace(FIELD_BLOCK, '\n');
}

function setField(text, description) {
  const body = description.split('\n').map(l => (l ? '  ' + l : '')).join('\n');
  return stripField(text).replace(/\s+$/, '') + `\n\n${FIELD}: |\n${body}\n`;
}

module.exports = { buildDescription, FIELD };

// CLI: regenerate the youtube_description field for every recorded meetup (or
// the folders passed as args). Meetups with youtube_url: null have it removed.
if (require.main === module) {
  const meetupsDir = path.join(__dirname, '..', 'Meetups');
  const args = process.argv.slice(2);
  const folders = args.length
    ? args
    : fs.readdirSync(meetupsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);

  let changed = 0;
  for (const folder of folders) {
    const yamlPath = path.join(meetupsDir, folder, 'metadata.yaml');
    if (!fs.existsSync(yamlPath)) continue;

    // Normalise to LF so the field-replacement regex works regardless of the
    // working copy's line endings (Windows checkouts are CRLF); output is LF.
    const text = fs.readFileSync(yamlPath, 'utf8').replace(/\r\n/g, '\n');
    const data = yaml.load(text);

    const updated = data.youtube_url
      ? setField(text, buildDescription(folder, data))
      : stripField(text).replace(/\s+$/, '') + '\n';

    if (updated !== text) {
      fs.writeFileSync(yamlPath, updated, 'utf8');
      changed++;
      console.log(`Updated youtube_description for meetup ${data.meetup}`);
    }
  }
  console.log(`\n${changed} metadata file(s) changed.`);
}
