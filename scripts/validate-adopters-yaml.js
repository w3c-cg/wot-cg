#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DATA_DIR = path.join(__dirname, '..', 'Adopters', 'data');
const MEETUPS_DIR = path.join(__dirname, '..', 'Meetups');

// File -> allowed values of 'type'. Files without types don't allow the field.
const FILES = {
  'companies.yaml': ['Company', 'Research'],
  'standard-development-organizations.yaml': null,
  'open-source.yaml': null,
};
const ALLOWED_FIELDS = ['name', 'type', 'projects', 'meetups', 'sources'];
const HTTP_RE = /^https?:\/\/\S+$/;

// Same folder naming as Adopters/meetups.js: "0", "01" to "09", then "10" onwards.
function meetupFolder(number) {
  return path.join(MEETUPS_DIR, number === 0 ? '0' : String(number).padStart(2, '0'));
}

const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';

function validateEntry(entry, types) {
  const errors = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ['must be a mapping'];

  for (const key of Object.keys(entry)) {
    if (!ALLOWED_FIELDS.includes(key)) errors.push(`unknown field '${key}'`);
  }

  if (!isNonEmptyString(entry.name)) errors.push("'name' must be a non-empty string");

  if (types) {
    if (!types.includes(entry.type)) errors.push(`'type' must be one of ${types.join(', ')}, got: '${entry.type}'`);
  } else if ('type' in entry) {
    errors.push("'type' is only used in companies.yaml");
  }

  if (!Array.isArray(entry.projects) || entry.projects.length === 0) {
    errors.push("'projects' must be a non-empty list");
  } else {
    entry.projects.forEach((p, i) => {
      if (!p || typeof p !== 'object') { errors.push(`projects[${i}] must be a mapping with a 'title'`); return; }
      if (!isNonEmptyString(p.title)) errors.push(`projects[${i}] missing 'title'`);
      if ('description' in p && !isNonEmptyString(p.description))
        errors.push(`projects[${i}].description must be a non-empty string`);
      for (const key of Object.keys(p)) {
        if (key !== 'title' && key !== 'description') errors.push(`projects[${i}] has unknown field '${key}'`);
      }
    });
  }

  if ('meetups' in entry) {
    if (!Array.isArray(entry.meetups) || entry.meetups.length === 0) {
      errors.push("'meetups' must be a non-empty list of meetup numbers, e.g. [6, 29]");
    } else {
      for (const n of entry.meetups) {
        if (!Number.isInteger(n) || n < 0) errors.push(`meetup '${n}' must be a whole number`);
        else if (!fs.existsSync(meetupFolder(n))) errors.push(`meetup ${n} has no folder in Meetups/`);
      }
    }
  }

  if ('sources' in entry) {
    if (!Array.isArray(entry.sources) || entry.sources.length === 0) {
      errors.push("'sources' must be a non-empty list");
    } else {
      entry.sources.forEach((s, i) => {
        if (!s || typeof s !== 'object') { errors.push(`sources[${i}] must be a mapping with 'label' and 'link'`); return; }
        if (!isNonEmptyString(s.label)) errors.push(`sources[${i}] missing 'label'`);
        if (!HTTP_RE.test(String(s.link ?? ''))) errors.push(`sources[${i}].link must be an http(s) URL, got: '${s.link}'`);
      });
    }
  }

  // Every adopter needs evidence: a meetup or another source.
  if (!('meetups' in entry) && !('sources' in entry)) errors.push("needs 'meetups', 'sources' or both");

  return errors;
}

let allValid = true;
let total = 0;
const seenNames = new Map();

for (const [file, types] of Object.entries(FILES)) {
  const filePath = path.join(DATA_DIR, file);
  let entries;
  try {
    entries = yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.log(`FAIL  ${file}\n      - ${e.message}`);
    allValid = false;
    continue;
  }
  if (!Array.isArray(entries)) {
    console.log(`FAIL  ${file}\n      - file must contain a list of adopters`);
    allValid = false;
    continue;
  }

  const fileErrors = [];
  entries.forEach((entry, i) => {
    const label = entry && entry.name ? entry.name : `entry ${i + 1}`;
    for (const message of validateEntry(entry, types)) fileErrors.push(`${label}: ${message}`);

    if (entry && isNonEmptyString(entry.name)) {
      const key = entry.name.trim().toLowerCase();
      if (seenNames.has(key)) fileErrors.push(`${label}: duplicate name, already in ${seenNames.get(key)}`);
      else seenNames.set(key, file);
    }
  });
  total += entries.length;

  if (fileErrors.length > 0) {
    console.log(`FAIL  ${file}`);
    fileErrors.forEach(m => console.log(`      - ${m}`));
    allValid = false;
  } else {
    console.log(`OK    ${file} (${entries.length} adopters)`);
  }
}

// bindings.yaml: a list of { name }, shown in file order.
{
  const file = 'bindings.yaml';
  let bindings;
  try {
    bindings = yaml.load(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch (e) {
    bindings = e;
  }
  const errors = [];
  if (bindings instanceof Error) errors.push(bindings.message);
  else if (!Array.isArray(bindings)) errors.push('file must contain a list of bindings');
  else {
    const seen = new Set();
    bindings.forEach((b, i) => {
      if (!b || typeof b !== 'object' || !isNonEmptyString(b.name)) { errors.push(`entry ${i + 1}: 'name' must be a non-empty string`); return; }
      for (const key of Object.keys(b)) if (key !== 'name') errors.push(`${b.name}: unknown field '${key}'`);
      const key = b.name.trim().toLowerCase();
      if (seen.has(key)) errors.push(`${b.name}: duplicate name`);
      seen.add(key);
    });
  }

  if (errors.length > 0) {
    console.log(`FAIL  ${file}`);
    errors.forEach(m => console.log(`      - ${m}`));
    allValid = false;
  } else {
    console.log(`OK    ${file} (${bindings.length} bindings)`);
  }
}

if (!allValid) {
  console.log('\nValidation failed.');
  process.exit(1);
}

console.log(`\nAll ${total} adopters and the bindings are valid.`);
