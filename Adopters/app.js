// Builds the adopters page from the files in data/ and handles user interaction.

import { load as parseYaml } from './vendor/js-yaml.mjs';
import { tileLabel, initials } from './labels.js';
import { loadMeetup, meetupFolderUrl, formatMonth } from './meetups.js';

// ---------- settings ----------

// Section (data-group in index.html) -> data file.
const FILE_OF_GROUP = {
  companies: 'data/companies.yaml',
  sdo: 'data/standard-development-organizations.yaml',
  oss: 'data/open-source.yaml',
};
const BINDINGS_FILE = 'data/bindings.yaml';
// Written by adopters-deploy.yml, so it doesn't exist locally.
const LAST_UPDATED_FILE = 'data/last-updated.txt';

// Popup subtitle: the adopter's type in companies.yaml, otherwise the section.
const TYPE_LABELS = {
  Company: 'Company',
  Research: 'Research organization',
};
const GROUP_LABELS = {
  sdo: 'Standard development organization',
  oss: 'Open-source project',
};

const isEmbedded = window.parent !== window;

// ---------- small helpers ----------

const byId = id => document.getElementById(id);

/** Returns a copy of the first element in a <template>. */
function fromTemplate(id) {
  return byId(id).content.firstElementChild.cloneNode(true);
}

function sectionOf(group) {
  return document.querySelector(`.panel[data-group="${group}"]`);
}

// ---------- loading the data ----------

/** Returns the list in a data file. */
async function loadList(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`${file}: ${response.status}`);
  return parseYaml(await response.text()) ?? [];
}

/** Shows the date of the last data change in the footer, e.g. "2026-11-07" -> "November 2026". */
async function showLastUpdated() {
  try {
    const response = await fetch(LAST_UPDATED_FILE);
    if (!response.ok) return;
    const [year, month] = (await response.text()).trim().split('-').map(Number);
    if (!year || !month) return;
    byId('updated').textContent = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    byId('updated-note').hidden = false;
  } catch {
    // leave the note hidden
  }
}

/** Returns the adopters of a section, sorted by tile label. */
async function loadAdopters(group) {
  const adopters = await loadList(FILE_OF_GROUP[group]);
  return adopters.sort((a, b) => tileLabel(a.name).localeCompare(tileLabel(b.name), undefined, { sensitivity: 'base' }));
}

// ---------- tiles ----------

function createTile(adopter, group) {
  const tile = fromTemplate('tile-template');
  const label = tileLabel(adopter.name);

  tile.title = adopter.name;   // full name on hover
  tile.querySelector('.tile-logo').textContent = initials(label);
  tile.querySelector('.tile-name').textContent = label;
  tile.addEventListener('click', () => openPopup(adopter, group));
  return tile;
}

function fillSection(group, adopters) {
  sectionOf(group).querySelector('.grid').append(...adopters.map(adopter => createTile(adopter, group)));
}

/** Bindings are plain cards in file order, without a popup. */
function fillBindings(bindings) {
  const cards = bindings.map(binding => {
    const card = document.createElement('div');
    card.className = 'binding';
    card.textContent = binding.name;
    return card;
  });
  sectionOf('bindings').querySelector('.grid').append(...cards);
}

/** Sets each section's count badge to its number of tiles. */
function updateCounts() {
  for (const section of document.querySelectorAll('.panel')) {
    section.querySelector('.count').textContent = section.querySelector('.grid').children.length;
  }
}

// ---------- collapsing sections ----------
// The animation is in styles.css; this only toggles the is-collapsed class.

function toggleSection(section) {
  const collapsed = section.classList.toggle('is-collapsed');
  section.querySelector('.chev').setAttribute('aria-expanded', String(!collapsed));
  section.querySelector('.panel-body').inert = collapsed;   // removes hidden tiles from the tab order
  hideTooltip();
  updatePairLayout();
}

// In the side-by-side pair, a collapsed section next to an open one is shown as a vertical strip.
function updatePairLayout() {
  const pair = [...document.querySelectorAll('.pair > .panel')];
  const anyOpen = pair.some(section => !section.classList.contains('is-collapsed'));
  for (const section of pair) {
    section.classList.toggle('is-strip', anyOpen && section.classList.contains('is-collapsed'));
  }
}

function setUpSectionHeaders() {
  for (const header of document.querySelectorAll('.panel-head')) {
    header.addEventListener('click', event => {
      // Clicks on the info button or the header link don't toggle the section.
      if (event.target.closest('.info, a')) return;
      toggleSection(header.closest('.panel'));
    });
  }
}

// ---------- tooltips ----------
// All info buttons share one tooltip element.

const tooltip = byId('tip');
let activeInfoButton = null;

function showTooltip(button) {
  activeInfoButton = button;
  tooltip.textContent = button.dataset.tip;
  tooltip.hidden = false;

  // Center below the button, keep within the viewport, and move above if there is no room below.
  const gap = 8;
  const buttonBox = button.getBoundingClientRect();
  const maxLeft = window.innerWidth - tooltip.offsetWidth - gap;
  const left = Math.min(Math.max(gap, buttonBox.left + buttonBox.width / 2 - tooltip.offsetWidth / 2), maxLeft);
  let top = buttonBox.bottom + gap;
  if (top + tooltip.offsetHeight > window.innerHeight - gap) {
    top = Math.max(gap, buttonBox.top - tooltip.offsetHeight - gap);
  }
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  activeInfoButton = null;
  tooltip.hidden = true;
}

function setUpTooltips() {
  for (const button of document.querySelectorAll('.info')) {
    button.setAttribute('aria-describedby', 'tip');
    button.addEventListener('mouseenter', () => showTooltip(button));
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('focus', () => showTooltip(button));
    button.addEventListener('blur', hideTooltip);
    // Keyboard activation (detail 0) toggles the tooltip; pointer clicks always show it.
    button.addEventListener('click', event => {
      const fromKeyboard = event.detail === 0;
      if (fromKeyboard && activeInfoButton === button) hideTooltip();
      else showTooltip(button);
    });
  }

  // Hide on Escape, outside clicks, scroll and resize.
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); });
  document.addEventListener('click', event => { if (!event.target.closest('.info')) hideTooltip(); });
  window.addEventListener('scroll', hideTooltip, { passive: true });
  window.addEventListener('resize', hideTooltip);
}

// ---------- popup ----------

const popup = byId('detail');

function createProjectCard(project) {
  const card = fromTemplate('project-template');
  card.querySelector('.project-title').textContent = project.title;
  const description = card.querySelector('.project-desc');
  description.textContent = project.description ?? '';
  description.hidden = !project.description;
  return card;
}

function createSourceLink(source) {
  const item = fromTemplate('source-template');
  const link = item.querySelector('a');
  link.href = source.link;
  link.textContent = `${source.label} ↗`;
  return item;
}

/**
 * Creates a meetup row that links to the meetup folder. The title, date and
 * video link are added once the meetup's metadata.yaml has loaded.
 */
function createMeetupRow(number) {
  const row = fromTemplate('meetup-template');
  const link = row.querySelector('.meetup');
  link.href = meetupFolderUrl(number);
  row.querySelector('.meetup-number').textContent = `Meetup ${number}`;

  loadMeetup(number).then(meetup => {
    if (!meetup) return;
    if (meetup.title) row.querySelector('.meetup-name').textContent = ` · ${meetup.title}`;
    row.querySelector('.meetup-date').textContent = formatMonth(meetup.date);
    if (meetup.url) link.href = meetup.url;
  });
  return row;
}

/** Fills a popup list and hides its section when there are no items. */
function fillPopupList(sectionId, items) {
  const section = byId(sectionId);
  section.querySelector('ul').replaceChildren(...items);
  section.hidden = items.length === 0;
}

function openPopup(adopter, group) {
  popup.dataset.group = group;   // sets the accent color
  byId('detail-logo').textContent = initials(tileLabel(adopter.name));
  byId('detail-name').textContent = adopter.name;
  byId('detail-type').textContent = TYPE_LABELS[adopter.type] ?? GROUP_LABELS[group];

  fillPopupList('detail-projects', (adopter.projects ?? []).map(createProjectCard));
  fillPopupList('detail-meetups', (adopter.meetups ?? []).map(createMeetupRow));
  fillPopupList('detail-sources', (adopter.sources ?? []).map(createSourceLink));

  hideTooltip();
  popup.showModal();   // centered, with backdrop and Escape to close
  byId('detail-body').scrollTop = 0;
  if (isEmbedded) placePopupOnScreen();
}

// ---------- popup position when embedded ----------
// The iframe is as tall as the page content, so a centered popup can end up outside the
// visible area. IntersectionObserver returns the part of the page that is visible in the
// top-level viewport (also for cross-origin iframes); the popup is placed within it.

function visiblePartOfPage() {
  return new Promise(resolve => {
    const observer = new IntersectionObserver(([entry]) => {
      observer.disconnect();
      resolve(entry.intersectionRect);
    });
    observer.observe(document.documentElement);
  });
}

async function placePopupOnScreen() {
  const gap = 16;
  const visible = await visiblePartOfPage();
  popup.style.maxHeight = `${Math.min(760, Math.max(240, visible.height - 2 * gap))}px`;
  const top = Math.max(visible.top + gap, visible.top + (visible.height - popup.offsetHeight) / 2);
  popup.style.margin = `${top}px auto auto`;
}

function setUpPopup() {
  byId('detail-close').addEventListener('click', () => popup.close());
  // Backdrop clicks target the <dialog> element itself.
  popup.addEventListener('click', event => { if (event.target === popup) popup.close(); });
}

// ---------- iframe support ----------
// When embedded, the content height is posted to the parent window so it can resize
// the iframe (see the README).

function reportHeightToParent() {
  const content = document.querySelector('.wrap');
  // Measure .wrap, not the document: the document is never shorter than the iframe.
  const height = Math.ceil(content.getBoundingClientRect().height);
  window.parent.postMessage({ type: 'wot-adopters:height', height }, '*');
}

// ---------- start ----------

async function start() {
  showLastUpdated();
  if (isEmbedded) document.documentElement.classList.add('is-embedded');

  const groups = Object.keys(FILE_OF_GROUP);
  let adoptersByGroup, bindings;
  try {
    [bindings, ...adoptersByGroup] = await Promise.all([loadList(BINDINGS_FILE), ...groups.map(loadAdopters)]);
  } catch {
    byId('load-msg').textContent =
      'Could not load the adopter data. If you opened index.html directly, serve the folder with a local web server instead.';
    return;
  }

  let total = 0;
  groups.forEach((group, i) => {
    fillSection(group, adoptersByGroup[i]);
    total += adoptersByGroup[i].length;
  });
  fillBindings(bindings);
  updateCounts();
  byId('total').textContent = total;

  setUpSectionHeaders();
  setUpTooltips();
  setUpPopup();

  byId('load-msg').hidden = true;
  byId('sections').hidden = false;

  if (isEmbedded) {
    new ResizeObserver(reportHeightToParent).observe(document.querySelector('.wrap'));
  }
}

start();
