# Meetup automation scripts

Each meetup folder (`Meetups/<n>/`) has a `metadata.yaml`. That one file is the
source of truth. From it we generate, **in the pull request**:

- `Meetups/Readme.md` (the whole meetups listing), and
- the `youtube_description` field inside each `metadata.yaml` (the video's full
  YouTube description + relevant links), so the exact text is reviewable on GitHub.

The author runs the generators and commits the results; CI fails the PR if they
are out of date. On merge, the `youtube_description` is pushed to the video via
the API.

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
    organisation: "TU Munich"       # required (use null if there is none)
    bio: null                       # optional; null = placeholder to fill in later
presenter_slides:                   # optional
  - file: "...Binkert.pdf"          # file in this folder, OR:
    url: "https://..."              # online version (either/both)
    label: "..."                    # required only if there are 2+ entries
thumbnail: "W3C_WoT_Meetup_33.png"  # required
description: >-                     # required, use >- for long text / quotes
  ...
youtube_description: |              # GENERATED - do not edit by hand
  ...
```

---

## Running the workflow (step by step)

To add or change a meetup, from the repo root:

1. **Edit the meetup.** Create/update `Meetups/<n>/metadata.yaml` and drop the
   slides, minutes and thumbnail into that same folder.
2. **Install deps once:** `cd scripts && npm ci && cd ..`
3. **Regenerate the derived content:**
   ```bash
   node scripts/update-meetups-readme.js      # rebuilds Meetups/Readme.md
   node scripts/build-youtube-description.js   # writes youtube_description into metadata.yaml
   ```
4. **Validate:** `node scripts/validate-video-yaml.js` (must print all files valid).
5. **Commit & open a PR.** CI (`validate-videos.yml`) re-runs validation and
   **fails the PR if the generated files are stale** - so always run step 3 first.
6. **Merge to `main`.** For meetups with a `youtube_url`, `update-youtube.yml`
   pauses at the `youtube-prod` approval gate; once approved it pushes the new
   `youtube_description` to the video. Nothing on YouTube changes until then.

---

## Scripts

Run from the repo root (deps: `cd scripts && npm ci`, only `js-yaml`).

| Script | What it does | Run it |
|---|---|---|
| `validate-video-yaml.js` | Checks every `metadata.yaml` | `node scripts/validate-video-yaml.js` |
| `update-meetups-readme.js` | Regenerates `Meetups/Readme.md` | `node scripts/update-meetups-readme.js` |
| `build-youtube-description.js` | Writes the `youtube_description` field into each metadata.yaml | `node scripts/build-youtube-description.js` |
| `update-youtube.js` | Pushes the description files to YouTube (dry-run unless `--apply`) | see below |

After editing any `metadata.yaml`, run the two generators and commit the result:

```bash
node scripts/update-meetups-readme.js
node scripts/build-youtube-description.js
```

Both are idempotent - re-running changes nothing if you are already up to date.

---

## Workflows

| Workflow | Trigger | Does |
|---|---|---|
| `validate-videos.yml` | PR / push under `Meetups/` or `scripts/` | validates metadata, and **fails if the generated files are stale** |
| `update-youtube.yml` | push to `main` under `Meetups/**/metadata.yaml` | pushes changed videos' descriptions via the API |

There is no auto-commit workflow: the README and description files are committed
by the author and only verified by CI.

`update-youtube.yml` only touches the videos whose `metadata.yaml` changed in
that push, skips meetups with `youtube_url: null`, and pauses at the
`youtube-prod` environment for approval first.

---

## Setup for the YouTube push

- Secrets (Settings → Secrets and variables → Actions): `YT_CLIENT_ID`,
  `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN` (OAuth; the token is minted once from an
  account that can edit the channel).
- Environment (Settings → Environments): create **`youtube-prod`** and add a
  required reviewer. Without it, the push runs with no approval pause.
- `REPO_BASE` in `build-youtube-description.js` must point at the permanent repo
  (links in the descriptions derive from it).

---

## Testing the YouTube push

Safest first. The description text comes from the committed `youtube_description`
field, so run `build-youtube-description.js` first.

```bash
node scripts/build-youtube-description.js          # 1. write the fields (no network)
```

Set credentials for this terminal, then dry-run (reads the video, prints what it
would set, writes nothing):

```powershell
# PowerShell
$env:YT_CLIENT_ID = "..."
$env:YT_CLIENT_SECRET = "..."
$env:YT_REFRESH_TOKEN = "..."
```
```bash
# bash
export YT_CLIENT_ID=... YT_CLIENT_SECRET=... YT_REFRESH_TOKEN=...
```
```bash
node scripts/update-youtube.js Meetups/33/metadata.yaml            # 2. dry-run
node scripts/update-youtube.js Meetups/33/metadata.yaml --apply    # 3. real write
```

To backfill every recorded video at once:
```bash
node scripts/update-youtube.js Meetups/*/metadata.yaml --apply
```

---
