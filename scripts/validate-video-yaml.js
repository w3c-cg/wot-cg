#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('../Tutorials/whatiswot/website/node_modules/js-yaml');

const REQUIRED_FIELDS = ['meetup', 'title', 'date', 'speakers', 'youtube_url', 'presenter_slides', 'intro_slides', 'minutes'];
const YOUTUBE_RE = /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+|^https?:\/\/youtu\.be\/[\w-]+/;
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

  if ('date' in data && !DATE_RE.test(String(data.date))) {
    errors.push(`'date' must be in DD-MM-YYYY format, got: '${data.date}'`);
  }

  if ('youtube_url' in data) {
    if (typeof data.youtube_url !== 'string') {
      errors.push("'youtube_url' must be a string");
    } else if (!YOUTUBE_RE.test(data.youtube_url)) {
      errors.push(`'youtube_url' must be a valid YouTube URL, got: '${data.youtube_url}'`);
    }
  }

  if ('speakers' in data) {
    if (!Array.isArray(data.speakers) || data.speakers.length === 0) {
      errors.push("'speakers' must be a non-empty list");
    } else {
      data.speakers.forEach((s, i) => {
        if (!s || typeof s !== 'object') errors.push(`speakers[${i}] must be a mapping`);
        else if (!s.name || !String(s.name).trim()) errors.push(`speakers[${i}] missing required field 'name'`);
      });
    }
  }

  if ('presenter_slides' in data) {
    if (!Array.isArray(data.presenter_slides) || data.presenter_slides.length === 0) {
      errors.push("'presenter_slides' must be a non-empty list");
    } else {
      data.presenter_slides.forEach((s, i) => {
        if (!s || typeof s !== 'object') errors.push(`presenter_slides[${i}] must be a mapping`);
        else if (!s.file || !String(s.file).trim()) errors.push(`presenter_slides[${i}] missing required field 'file'`);
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
  if ('thumbnail' in data && typeof data.thumbnail !== 'string')
    errors.push("'thumbnail' must be a string URL");
  if ('description' in data && typeof data.description !== 'string')
    errors.push("'description' must be a string");

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
