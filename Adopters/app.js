import { load as parseYaml } from './vendor/js-yaml.mjs';
import { tileLabel, initials } from './labels.js';
import { loadMeetup, meetupFolderUrl, formatMonth } from './meetups.js';

// data-group in index.html -> data file
const FILES = {
  industry: 'data/industry.yaml',
  sdo: 'data/standard-development-organizations.yaml',
  oss: 'data/open-source.yaml',
  research: 'data/research.yaml',
};
const BINDINGS_FILE = 'data/bindings.yaml';
// Written on deploy (adopters-deploy.yml), missing when running locally.
const LAST_UPDATED_FILE = 'data/last-updated.txt';

const GROUP_LABELS = {
  industry: 'Company',
  sdo: 'Standard development organization',
  oss: 'Open-source project',
  research: 'Research organization',
};

const isEmbedded = window.parent !== window;
const byId = id => document.getElementById(id);
const popup = byId('detail');
const tooltip = byId('tip');
let tooltipButton = null;

function fromTemplate(id) {
  return byId(id).content.firstElementChild.cloneNode(true);
}

function sectionOf(group) {
  return document.querySelector(`.panel[data-group="${group}"]`);
}

async function loadList(file) {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`${file}: ${res.status}`);
  return parseYaml(await res.text()) ?? [];
}

async function loadAdopters(group) {
  const adopters = await loadList(FILES[group]);
  return adopters.sort((a, b) => tileLabel(a.name).localeCompare(tileLabel(b.name), undefined, { sensitivity: 'base' }));
}

// "2026-11-07" -> "November 2026"
async function showLastUpdated() {
  try {
    const res = await fetch(LAST_UPDATED_FILE);
    if (!res.ok) return;
    const [year, month] = (await res.text()).trim().split('-').map(Number);
    if (!year || !month) return;
    byId('updated').textContent = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    byId('updated-note').hidden = false;
  } catch {}
}

function createTile(adopter, group) {
  const tile = fromTemplate('tile-template');
  const label = tileLabel(adopter.name);
  tile.title = adopter.name;
  tile.querySelector('.tile-logo').textContent = initials(label);
  tile.querySelector('.tile-name').textContent = label;
  tile.addEventListener('click', () => openPopup(adopter, group));
  return tile;
}

function fillSection(group, adopters) {
  sectionOf(group).querySelector('.grid').append(...adopters.map(a => createTile(a, group)));
}

function fillBindings(bindings) {
  const cards = bindings.map(b => {
    const card = document.createElement('a');
    card.className = 'binding';
    card.href = b.link;
    card.target = '_blank';
    card.rel = 'noopener';
    card.textContent = b.name;
    return card;
  });
  sectionOf('bindings').querySelector('.grid').append(...cards);
}

function updateCounts() {
  for (const section of document.querySelectorAll('.panel')) {
    section.querySelector('.count').textContent = section.querySelector('.grid').children.length;
  }
}

// Collapsing sections. The animation is done in CSS.

function toggleSection(section) {
  const collapsed = section.classList.toggle('is-collapsed');
  section.querySelector('.chev').setAttribute('aria-expanded', String(!collapsed));
  // inert keeps the hidden tiles out of the tab order
  section.querySelector('.panel-body').inert = collapsed;
  hideTooltip();
  updatePairLayout();
}

// In the side-by-side pair, a collapsed section next to an open one becomes a vertical strip.
function updatePairLayout() {
  const pair = [...document.querySelectorAll('.pair > .panel')];
  const anyOpen = pair.some(s => !s.classList.contains('is-collapsed'));
  for (const s of pair) s.classList.toggle('is-strip', anyOpen && s.classList.contains('is-collapsed'));
}

function setUpSectionHeaders() {
  for (const header of document.querySelectorAll('.panel-head')) {
    header.addEventListener('click', e => {
      if (e.target.closest('.info, a')) return;
      toggleSection(header.closest('.panel'));
    });
  }
}

// Tooltip for the "?" buttons. All buttons share one element.

function showTooltip(button) {
  tooltipButton = button;
  tooltip.textContent = button.dataset.tip;
  tooltip.hidden = false;

  // Below the button and inside the viewport, or above it if there is no room below.
  const gap = 8;
  const box = button.getBoundingClientRect();
  const maxLeft = window.innerWidth - tooltip.offsetWidth - gap;
  const left = Math.min(Math.max(gap, box.left + box.width / 2 - tooltip.offsetWidth / 2), maxLeft);
  let top = box.bottom + gap;
  if (top + tooltip.offsetHeight > window.innerHeight - gap) {
    top = Math.max(gap, box.top - tooltip.offsetHeight - gap);
  }
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltipButton = null;
  tooltip.hidden = true;
}

function setUpTooltips() {
  for (const button of document.querySelectorAll('.info')) {
    button.setAttribute('aria-describedby', 'tip');
    button.addEventListener('mouseenter', () => showTooltip(button));
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('focus', () => showTooltip(button));
    button.addEventListener('blur', hideTooltip);
    // Enter/Space (detail is 0) toggles it, a mouse click always shows it.
    button.addEventListener('click', e => {
      if (e.detail === 0 && tooltipButton === button) hideTooltip();
      else showTooltip(button);
    });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTooltip(); });
  document.addEventListener('click', e => { if (!e.target.closest('.info')) hideTooltip(); });
  window.addEventListener('scroll', hideTooltip, { passive: true });
  window.addEventListener('resize', hideTooltip);
}

// Popup

function createProject(project) {
  const item = fromTemplate('project-template');
  item.querySelector('.project-title').textContent = project.title;
  const desc = item.querySelector('.project-desc');
  desc.textContent = project.description ?? '';
  desc.hidden = !project.description;
  return item;
}

function createSource(source) {
  const item = fromTemplate('source-template');
  const link = item.querySelector('a');
  link.href = source.link;
  link.textContent = `${source.label} ↗`;
  return item;
}

// Links to the meetup folder until metadata.yaml has loaded, then to the video.
function createMeetup(number) {
  const item = fromTemplate('meetup-template');
  const link = item.querySelector('.meetup');
  link.href = meetupFolderUrl(number);
  item.querySelector('.meetup-number').textContent = `Meetup ${number}`;

  loadMeetup(number).then(meetup => {
    if (!meetup) return;
    if (meetup.title) item.querySelector('.meetup-name').textContent = ` · ${meetup.title}`;
    item.querySelector('.meetup-date').textContent = formatMonth(meetup.date);
    if (meetup.url) link.href = meetup.url;
  });
  return item;
}

// Empty lists hide their section.
function fillPopupList(id, items) {
  const section = byId(id);
  section.querySelector('ul').replaceChildren(...items);
  section.hidden = items.length === 0;
}

function openPopup(adopter, group) {
  popup.dataset.group = group;
  byId('detail-logo').textContent = initials(tileLabel(adopter.name));
  byId('detail-name').textContent = adopter.name;
  byId('detail-type').textContent = GROUP_LABELS[group];

  fillPopupList('detail-products', (adopter.products ?? []).map(createProject));
  fillPopupList('detail-contributions', (adopter.contributions ?? []).map(createProject));
  fillPopupList('detail-projects', (adopter.projects ?? []).map(createProject));
  fillPopupList('detail-meetups', (adopter.meetups ?? []).map(createMeetup));
  fillPopupList('detail-sources', (adopter.sources ?? []).map(createSource));

  hideTooltip();
  popup.showModal();
  byId('detail-body').scrollTop = 0;
  if (isEmbedded) placePopup();
}

// When embedded, the iframe is as tall as the page, so a centered popup can be off screen.
// IntersectionObserver gives the part of the page that is visible (also cross-origin),
// and the popup is placed in there.
function visibleRect() {
  return new Promise(resolve => {
    const observer = new IntersectionObserver(([entry]) => {
      observer.disconnect();
      resolve(entry.intersectionRect);
    });
    observer.observe(document.documentElement);
  });
}

async function placePopup() {
  const gap = 16;
  const visible = await visibleRect();
  popup.style.maxHeight = `${Math.min(760, Math.max(240, visible.height - 2 * gap))}px`;
  const top = Math.max(visible.top + gap, visible.top + (visible.height - popup.offsetHeight) / 2);
  popup.style.margin = `${top}px auto auto`;
}

function setUpPopup() {
  byId('detail-close').addEventListener('click', () => popup.close());
  // A click on the backdrop has the dialog itself as target.
  popup.addEventListener('click', e => { if (e.target === popup) popup.close(); });
}

// Lets the parent page resize the iframe, see the README.
// .wrap is measured because the document is never shorter than the iframe.
function postHeight() {
  const height = Math.ceil(document.querySelector('.wrap').getBoundingClientRect().height);
  window.parent.postMessage({ type: 'wot-adopters:height', height }, '*');
}

async function start() {
  showLastUpdated();
  if (isEmbedded) document.documentElement.classList.add('is-embedded');

  const groups = Object.keys(FILES);
  let bindings, adopters;
  try {
    [bindings, ...adopters] = await Promise.all([loadList(BINDINGS_FILE), ...groups.map(loadAdopters)]);
  } catch {
    byId('load-msg').textContent =
      'Could not load the adopter data. If you opened index.html directly, serve the folder with a local web server instead.';
    return;
  }

  groups.forEach((group, i) => fillSection(group, adopters[i]));
  fillBindings(bindings);
  updateCounts();
  byId('total').textContent = adopters.flat().length;

  setUpSectionHeaders();
  setUpTooltips();
  setUpPopup();

  byId('load-msg').hidden = true;
  byId('sections').hidden = false;

  if (isEmbedded) new ResizeObserver(postHeight).observe(document.querySelector('.wrap'));
}

start();
