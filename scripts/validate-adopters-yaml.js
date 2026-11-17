#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DATA_DIR = path.join(__dirname, '..', 'Adopters', 'data');
const MEETUPS_DIR = path.join(__dirname, '..', 'Meetups');

// File -> the lists its entries use. An entry needs at least one of them.
const FILES = {
  'industry.yaml': ['products', 'contributions'],
  'standard-development-organizations.yaml': ['projects'],
  'open-source.yaml': ['projects'],
  'research.yaml': ['projects'],
};
const COMMON_FIELDS = ['name', 'meetups', 'sources'];
const HTTP_RE = /^https?:\/\/\S+$/;

const isText = v => typeof v === 'string' && v.trim() !== '';

// Same folder names as Adopters/meetups.js.
function meetupFolder(n) {
  return path.join(MEETUPS_DIR, n === 0 ? '0' : String(n).padStart(2, '0'));
}

function validateItems(list, field, errors) {
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`'${field}' must be a non-empty list`);
    return;
  }
  list.forEach((p, i) => {
    if (!p || typeof p !== 'object') { errors.push(`${field}[${i}] must be a mapping with a 'title'`); return; }
    if (!isText(p.title)) errors.push(`${field}[${i}] missing 'title'`);
    if ('description' in p && !isText(p.description)) errors.push(`${field}[${i}].description must be a non-empty string`);
    for (const key of Object.keys(p)) {
      if (key !== 'title' && key !== 'description') errors.push(`${field}[${i}] has unknown field '${key}'`);
    }
  });
}

function validateEntry(entry, listFields) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ['must be a mapping'];
  const errors = [];

  for (const key of Object.keys(entry)) {
    if (!COMMON_FIELDS.includes(key) && !listFields.includes(key)) errors.push(`unknown field '${key}'`);
  }

  if (!isText(entry.name)) errors.push("'name' must be a non-empty string");

  const lists = listFields.filter(f => f in entry);
  if (lists.length === 0) errors.push(`needs ${listFields.map(f => `'${f}'`).join(' or ')}`);
  for (const field of lists) validateItems(entry[field], field, errors);

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
        if (!isText(s.label)) errors.push(`sources[${i}] missing 'label'`);
        if (!HTTP_RE.test(String(s.link ?? ''))) errors.push(`sources[${i}].link must be an http(s) URL, got: '${s.link}'`);
      });
    }
  }

  return errors;
}

function validateBinding(b) {
  if (!b || typeof b !== 'object' || !isText(b.name)) return ["'name' must be a non-empty string"];
  const errors = [];
  if (!HTTP_RE.test(String(b.link ?? ''))) errors.push(`'link' must be an http(s) URL, got: '${b.link}'`);
  for (const key of Object.keys(b)) {
    if (key !== 'name' && key !== 'link') errors.push(`unknown field '${key}'`);
  }
  return errors;
}

// Returns the list in a data file, or null after printing why it couldn't be read.
function loadList(file) {
  let list;
  try {
    list = yaml.load(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch (e) {
    console.log(`FAIL  ${file}\n      - ${e.message}`);
    return null;
  }
  if (!Array.isArray(list)) {
    console.log(`FAIL  ${file}\n      - file must contain a list`);
    return null;
  }
  return list;
}

function report(file, errors, summary) {
  if (errors.length > 0) {
    console.log(`FAIL  ${file}`);
    errors.forEach(m => console.log(`      - ${m}`));
    return false;
  }
  console.log(`OK    ${file} (${summary})`);
  return true;
}

let allValid = true;
let total = 0;
// Names must be unique across all files.
const seenNames = new Map();

for (const [file, listFields] of Object.entries(FILES)) {
  const entries = loadList(file);
  if (!entries) { allValid = false; continue; }

  const errors = [];
  entries.forEach((entry, i) => {
    const label = isText(entry?.name) ? entry.name : `entry ${i + 1}`;
    for (const m of validateEntry(entry, listFields)) errors.push(`${label}: ${m}`);

    if (isText(entry?.name)) {
      const key = entry.name.trim().toLowerCase();
      if (seenNames.has(key)) errors.push(`${label}: duplicate name, already in ${seenNames.get(key)}`);
      else seenNames.set(key, file);
    }
  });
  total += entries.length;
  if (!report(file, errors, `${entries.length} adopters`)) allValid = false;
}

const bindings = loadList('bindings.yaml');
if (!bindings) {
  allValid = false;
} else {
  const errors = [];
  const seen = new Set();
  bindings.forEach((b, i) => {
    const label = isText(b?.name) ? b.name : `entry ${i + 1}`;
    for (const m of validateBinding(b)) errors.push(`${label}: ${m}`);

    if (isText(b?.name)) {
      const key = b.name.trim().toLowerCase();
      if (seen.has(key)) errors.push(`${label}: duplicate name`);
      seen.add(key);
    }
  });
  if (!report('bindings.yaml', errors, `${bindings.length} bindings`)) allValid = false;
}

if (!allValid) {
  console.log('\nValidation failed.');
  process.exit(1);
}

console.log(`\nAll ${total} adopters and the bindings are valid.`);
