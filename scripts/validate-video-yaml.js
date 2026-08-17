#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const REQUIRED_FIELDS = ['meetup', 'title', 'date', 'speakers', 'youtube_url', 'intro_slides', 'minutes', 'w3c_event_link', 'thumbnail', 'description'];
const YOUTUBE_RE = /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+|^https?:\/\/youtu\.be\/[\w-]+/;
const W3C_EVENT_RE = /^https:\/\/www\.w3\.org\/events\/meetings\/[\w-]+\//;
const HTTP_RE = /^https?:\/\/\S+$/;
const DATE_RE = /^\d{2}-\d{2}-\d{4}$/;

function validate(filePath) {
  const errors = [];
  let data;

  try {
    data = yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return [`YAML parse error: ${e.message}`];
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['File must contain a YAML mapping (key-value pairs)'];
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) errors.push(`Missing required field: '${field}'`);
  }

  if ('meetup' in data && !Number.isInteger(data.meetup)) {
    errors.push(`'meetup' must be an integer, got: ${typeof data.meetup}`);
  }

  if ('title' in data) {
    if (typeof data.title !== 'string') errors.push("'title' must be a string");
    else if (!data.title.trim()) errors.push("'title' must not be empty");
  }

  if ('date' in data) {
    const date = String(data.date);
    if (!DATE_RE.test(date)) {
      errors.push(`'date' must be in DD-MM-YYYY format, got: '${date}'`);
    } else {
      // The regex only counts digits, so "45-99-2026" would pass.
      const [d, m] = date.split('-').map(n => parseInt(n, 10));
      if (m < 1 || m > 12) errors.push(`'date' has an invalid month: '${date}'`);
      if (d < 1 || d > 31) errors.push(`'date' has an invalid day: '${date}'`);
    }
  }

  // null means the meetup was not recorded. The key itself is still required
  // so nobody forgets to add the video.
  if ('youtube_url' in data && data.youtube_url !== null) {
    if (typeof data.youtube_url !== 'string') {
      errors.push("'youtube_url' must be a YouTube URL, or null if the meetup was not recorded");
    } else if (!YOUTUBE_RE.test(data.youtube_url)) {
      errors.push(`'youtube_url' must be a valid YouTube URL (or null if not recorded), got: '${data.youtube_url}'`);
    }
  }

  if ('w3c_event_link' in data) {
    if (typeof data.w3c_event_link !== 'string') {
      errors.push("'w3c_event_link' must be a string");
    } else if (!W3C_EVENT_RE.test(data.w3c_event_link)) {
      errors.push(`'w3c_event_link' must be a w3.org event URL (https://www.w3.org/events/meetings/<id>/), got: '${data.w3c_event_link}'`);
    }
  }

  if ('speakers' in data) {
    if (!Array.isArray(data.speakers) || data.speakers.length === 0) {
      errors.push("'speakers' must be a non-empty list");
    } else {
      data.speakers.forEach((s, i) => {
        if (!s || typeof s !== 'object') { errors.push(`speakers[${i}] must be a mapping`); return; }
        if (!s.name || !String(s.name).trim()) errors.push(`speakers[${i}] missing required field 'name'`);
        // organisation is required, but may be null when there is none.
        if (!('organisation' in s)) errors.push(`speakers[${i}] missing 'organisation' (use null if there is none)`);
        else if (s.organisation !== null && (typeof s.organisation !== 'string' || !s.organisation.trim()))
          errors.push(`speakers[${i}].organisation must be a string or null`);
        // bio is optional; null means "to be filled in" (placeholder).
        if ('bio' in s && s.bio !== null && (typeof s.bio !== 'string' || !s.bio.trim()))
          errors.push(`speakers[${i}].bio must be a non-empty string or null`);
      });
    }
  }

  if ('presenter_slides' in data) {
    if (!Array.isArray(data.presenter_slides) || data.presenter_slides.length === 0) {
      errors.push("'presenter_slides' must be a non-empty list");
    } else {
      data.presenter_slides.forEach((s, i) => {
        if (!s || typeof s !== 'object') { errors.push(`presenter_slides[${i}] must be a mapping`); return; }

        // Needs at least one of the two, otherwise it links to nothing.
        const hasFile = s.file && String(s.file).trim();
        const hasUrl = s.url && String(s.url).trim();
        if (!hasFile && !hasUrl) {
          errors.push(`presenter_slides[${i}] needs a 'file' (local PDF) or a 'url' (online version)`);
        }
        if (hasUrl && !HTTP_RE.test(String(s.url))) {
          errors.push(`presenter_slides[${i}].url must be an http(s) URL, got: '${s.url}'`);
        }
        if (data.presenter_slides.length > 1 && !s.label) {
          errors.push(`presenter_slides[${i}] missing 'label' (required to distinguish multiple presenter slide files)`);
        }
      });
    }
  }

  if ('intro_slides' in data) {
    if (!data.intro_slides || typeof data.intro_slides !== 'object') {
      errors.push("'intro_slides' must be a mapping");
    } else {
      if ('google_slides' in data.intro_slides && typeof data.intro_slides.google_slides !== 'string')
        errors.push("'intro_slides.google_slides' must be a string URL");
      if ('pdf' in data.intro_slides && typeof data.intro_slides.pdf !== 'string')
        errors.push("'intro_slides.pdf' must be a string filename");
    }
  }

  if ('minutes' in data && typeof data.minutes !== 'string')
    errors.push("'minutes' must be a string filename");
  if ('thumbnail' in data && (typeof data.thumbnail !== 'string' || !data.thumbnail.trim()))
    errors.push("'thumbnail' must be a string filename (an image file in this folder)");
  if ('description' in data && (typeof data.description !== 'string' || !data.description.trim()))
    errors.push("'description' must be a non-empty string (copy it from the W3C calendar entry and adapt it to the past tense)");
  if ('youtube_description' in data && typeof data.youtube_description !== 'string')
    errors.push("'youtube_description' must be a string (it is generated - run build-youtube-description.js)");

  return errors;
}

function findYamlFiles() {
  const meetupsDir = path.join(__dirname, '..', 'Meetups');
  return fs.readdirSync(meetupsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(e => path.join(meetupsDir, e.name, 'metadata.yaml'))
    .filter(p => fs.existsSync(p));
}

const files = process.argv.length > 2 ? process.argv.slice(2) : findYamlFiles();

if (files.length === 0) {
  console.log('No metadata.yaml files found — nothing to validate.');
  process.exit(0);
}

let allValid = true;
for (const filePath of files) {
  const errors = validate(filePath);
  if (errors.length > 0) {
    console.log(`FAIL  ${filePath}`);
    errors.forEach(m => console.log(`      - ${m}`));
    allValid = false;
  } else {
    console.log(`OK    ${filePath}`);
  }
}

if (!allValid) {
  console.log('\nValidation failed.');
  process.exit(1);
}

console.log(`\nAll ${files.length} file(s) valid.`);
