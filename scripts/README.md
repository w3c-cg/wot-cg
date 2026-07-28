# Meetup automation scripts

Each meetup folder (`Meetups/<n>/`) has a `metadata.yaml`. That one file is the
source of truth - from it we:

1. **validate** the entry on every pull request,
2. **regenerate** `Meetups/Readme.md` on merge to `main` with the updated metadata,
3. **update the video's YouTube description** on merge to `main`.

---

## metadata.yaml

```yaml
meetup: 33                          # required, integer, matches the folder
title: "..."                        # required
date: "24-04-2026"                  # required, DD-MM-YYYY
youtube_url: "https://youtu.be/..." # required (or null if never recorded)
w3c_event_link: "https://www.w3.org/events/meetings/.../"  # required
minutes: "2026-04-24-minutes.md"    # required, file in this folder
intro_slides:                       # required
  google_slides: "https://docs.google.com/..."
  pdf: "...AguzziKorkan.pdf"        # file in this folder
speakers:                           # required, non-empty
  - name: "Roman Binkert"           # required
    organisation: "TU Munich"       # optional
    bio: "..."                      # optional (collapsible in the README)
presenter_slides:                   # optional
  - file: "...Binkert.pdf"          # file in this folder, OR:
    url: "https://..."              # online version (either/both)
    label: "..."                    # required only if there are 2+ entries
thumbnail: "W3C_WoT_Meetup_33.png"  # optional, image in this folder
description: >-                      # optional, use >- for long text / quotes
  ...
```

---

## Scripts

Run from `scripts/`. Dependencies: `npm ci` (only `js-yaml`).

| Script | What it does | Run it |
|---|---|---|
| `validate-video-yaml.js` | Checks every `metadata.yaml` | `node validate-video-yaml.js` |
| `update-meetups-readme.js` | Regenerates `Meetups/Readme.md` | `node update-meetups-readme.js` |
| `build-youtube-description.js` | Builds the links block for one meetup (no network) | `node build-youtube-description.js 33` |
| `update-youtube.js` | Updates YouTube descriptions (dry-run unless `--apply`) | see below |

---

## Workflows

| Workflow | Trigger | Does |
|---|---|---|
| `validate-videos.yml` | PR or push touching a `metadata.yaml` | runs the validator |
| `update-meetups-readme.yml` | push to `main` | regenerates + commits `Readme.md` |
| `update-youtube.yml` | push to `main` | updates changed videos' descriptions |

`update-youtube.yml` only touches the videos whose `metadata.yaml` changed in
that push, and pauses at the `youtube-prod` environment for approval first.

---

## Optional reviewer

(Settings → Environments): create **`youtube-prod`**,
add a required reviewer. Without it, the workflow runs automatically without the need for approval.

---

## Testing the YouTube updater

Safest first:

# 1. text only, no credentials
node build-youtube-description.js 33

# 2. test run: reads the real video, prints the merged description, writes nothing.
#    Set the credentials for this terminal first.

# PowerShell:
$env:YT_CLIENT_ID = "..."
$env:YT_CLIENT_SECRET = "..."
$env:YT_REFRESH_TOKEN = "..."

# bash:
export YT_CLIENT_ID=... YT_CLIENT_SECRET=... YT_REFRESH_TOKEN=...

node update-youtube.js ../Meetups/33/metadata.yaml

---