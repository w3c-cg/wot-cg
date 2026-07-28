#!/usr/bin/env node
'use strict';

//turn a meetup's metadata.yaml into the "links" part of its YouTube description

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const REPO_BASE = 'https://github.com/w3c-cg/wot-cg/blob/main/Meetups';

// Heading that marks the start of our section.
const HEADING = 'Useful Links:';

const fileUrl = (folder, file) => `${REPO_BASE}/${folder}/${encodeURIComponent(file)}`;

function linkLines(folder, data) {
  const lines = [];

  for (const s of data.presenter_slides ?? []) {
    const tag = s.label ? `Presenter slides (${s.label})` : 'Presenter slides';
    // A deck can be a local file, an online url, or both.
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

// Heading + the links under it.
function linksBlock(folder, data) {
  return [HEADING, ...linkLines(folder, data)].join('\n');
}

// Put the block at the end. If our heading is already there, replace from it
// down (so re-runs don't duplicate); otherwise append. Text above the heading
// is left untouched.
function mergeDescription(existing, block) {
  const current = (existing ?? '').replace(/\s+$/, '');
  const idx = current.indexOf(HEADING);
  const before = (idx === -1 ? current : current.slice(0, idx)).replace(/\s+$/, '');
  return before ? `${before}\n\n${block}` : block;
}

function loadMeetup(folder) {
  const p = path.join(__dirname, '..', 'Meetups', folder, 'metadata.yaml');
  return yaml.load(fs.readFileSync(p, 'utf8'));
}

module.exports = { linksBlock, mergeDescription, loadMeetup, HEADING };

// `node build-youtube-description.js <folder>` prints the block so you can check it. e.g. `node build-youtube-description.js 33`
if (require.main === module) {
  const folder = process.argv[2];
  if (!folder) {
    console.error('usage: node build-youtube-description.js <meetup-folder>  (e.g. 33 or 01)');
    process.exit(1);
  }
  console.log(linksBlock(folder, loadMeetup(folder)));
}
