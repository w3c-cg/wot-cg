#!/usr/bin/env node
'use strict';

//update each changed video's YouTube description from its metadata.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { linksBlock, mergeDescription } = require('./build-youtube-description.js');

const APPLY = process.argv.includes('--apply');
const files = process.argv.slice(2).filter(a => a !== '--apply');

function videoId(url) {
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?&/]/)[0];
  const v = new URL(url).searchParams.get('v');
  if (!v) throw new Error(`no video id found in: ${url}`);
  return v;
}

async function getAccessToken() {
  const missing = ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN'].filter(k => !process.env[k]);
  if (missing.length) throw new Error(`missing credentials: ${missing.join(', ')}`);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YT_CLIENT_ID,
      client_secret: process.env.YT_CLIENT_SECRET,
      refresh_token: process.env.YT_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${JSON.stringify(body)}`);
  return body.access_token;
}

async function getSnippet(id, token) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}`,
    { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${JSON.stringify(body)}`);
  if (!body.items || !body.items.length) throw new Error(`no video ${id} (can the token see it?)`);
  return body.items[0].snippet;
}

async function putSnippet(id, snippet, token) {
  const res = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, snippet }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`update failed: ${res.status} ${JSON.stringify(body)}`);
}

async function processFile(filePath, token) {
  const folder = path.basename(path.dirname(filePath));
  const data = yaml.load(fs.readFileSync(filePath, 'utf8'));

  if (!data.youtube_url) {                       // null = not recorded
    console.log(`skip  meetup ${data.meetup}: no video`);
    return;
  }

  const id = videoId(data.youtube_url);

  const snippet = await getSnippet(id, token);
  const merged = mergeDescription(snippet.description, linksBlock(folder, data));

  if (!APPLY) {
    console.log(`DRY   meetup ${data.meetup} (video ${id}) would become:\n\n${merged}\n`);
    return;
  }

  snippet.description = merged;
  await putSnippet(id, snippet, token);
  console.log(`ok    meetup ${data.meetup} (video ${id}) updated`);
}

async function main() {
  if (!files.length) {
    console.error('usage: node update-youtube.js <metadata.yaml> [more...] [--apply]');
    process.exitCode = 1;
    return;
  }
  const token = await getAccessToken();
  for (const f of files) await processFile(f, token);
}

main().catch(err => { console.error(err.message); process.exitCode = 1; });
