// Builds the adopters page from adopters.csv and handles user interaction.

import { parseCsv, parseProjects, parseMeetupNumbers, tileLabel, initials } from './parse.js';
import { loadMeetup, meetupFolderUrl, formatMonth } from './meetups.js';

// ---------- settings ----------

const LAST_UPDATED = 'November 2026';

// Section (data-group in index.html) -> CSV Category value.
const CATEGORY_OF_GROUP = {
  companies: 'Companies & research organizations',
  sdo: 'Standard development organizations',
  oss: 'Open-source projects',
};

// CSV Type value -> popup subtitle.
const TYPE_LABELS = {
  Company: 'Company',
  Research: 'Research organization',
  SDO: 'Standard development organization',
  'Open source': 'Open-source project',
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

async function loadAdopters() {
  const response = await fetch('adopters.csv');
  if (!response.ok) throw new Error(`adopters.csv: ${response.status}`);
  return parseCsv(await response.text());
}

/** Returns the adopters of a section, sorted by tile label. */
function adoptersInGroup(rows, group) {
  return rows
    .filter(row => row.Category === CATEGORY_OF_GROUP[group])
    .sort((a, b) => tileLabel(a.Name).localeCompare(tileLabel(b.Name), undefined, { sensitivity: 'base' }));
}

// ---------- tiles ----------

function createTile(adopter, group) {
  const tile = fromTemplate('tile-template');
  const label = tileLabel(adopter.Name);

  tile.title = adopter.Name;   // full name on hover
  tile.querySelector('.tile-logo').textContent = initials(label);
  tile.querySelector('.tile-name').textContent = label;
  tile.addEventListener('click', () => openPopup(adopter, group));
  return tile;
}

function fillSection(group, adopters) {
  sectionOf(group).querySelector('.grid').append(...adopters.map(adopter => createTile(adopter, group)));
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
  byId('detail-logo').textContent = initials(tileLabel(adopter.Name));
  byId('detail-name').textContent = adopter.Name;
  byId('detail-type').textContent = TYPE_LABELS[adopter.Type] ?? adopter.Type;

  fillPopupList('detail-projects', parseProjects(adopter['What they did with WoT']).map(createProjectCard));
  fillPopupList('detail-meetups', parseMeetupNumbers(adopter.Evidence).map(createMeetupRow));

  byId('detail-evidence').textContent = adopter.Evidence;
  byId('detail-evidence-link').href = adopter['Evidence link'];
  byId('detail-source').hidden = !adopter['Evidence link'];

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
  byId('updated').textContent = LAST_UPDATED;
  if (isEmbedded) document.documentElement.classList.add('is-embedded');

  let rows;
  try {
    rows = await loadAdopters();
  } catch {
    byId('load-msg').textContent =
      'Could not load adopters.csv. If you opened index.html directly, serve the folder with a local web server instead.';
    return;
  }

  let total = 0;
  for (const group of Object.keys(CATEGORY_OF_GROUP)) {
    const adopters = adoptersInGroup(rows, group);
    fillSection(group, adopters);
    total += adopters.length;
  }
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
