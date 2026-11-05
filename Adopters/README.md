# WoT Adopters page

A static page listing organizations and projects that use the Web of Things.
Live at https://w3c.github.io/wot-cg/adopters/, deployed by [adopters-deploy.yml](../.github/workflows/adopters-deploy.yml) when this folder changes on `main`.

## Files

- `adopters.csv`: the adopter list
- `index.html`: page structure, section titles, "?" texts and the bindings list
- `styles.css`: layout and styling
- `app.js`: builds the page from the CSV and handles interaction; `LAST_UPDATED` is at the top
- `parse.js`: CSV parsing and text helpers
- `meetups.js`: loads meetup details

## Adding an adopter

Add a row to `adopters.csv` and update `LAST_UPDATED` in `app.js`. Every row is shown, so only add confirmed adopters.

| Column | Notes |
| --- | --- |
| `Category` | `Companies & research organizations`, `Standard development organizations` or `Open-source projects` |
| `Type` | `Company`, `Research`, `SDO` or `Open source` |
| `Name` | A trailing acronym is used as the tile label, e.g. `Industrial Digital Twin Association (IDTA)` shows as `IDTA` |
| `What they did with WoT` | Projects separated by `;`. An optional trailing `(...)` is shown as a description |
| `Evidence` | Source text. Mentions like `Meetup 12` or `Meetups 20, 29` are listed under related meetups |
| `Evidence link` | URL for the source |

Meetup titles, dates and links are read from `Meetups/<nn>/metadata.yaml` on `main`, so new meetups need no extra work here.

## Embedding

The page posts its height to the parent window so the iframe can fit its content:

```html
<iframe id="wot-adopters" src="https://w3c.github.io/wot-cg/adopters/"
        title="Web of Things adopters" style="width:100%; border:0; height:1500px"></iframe>
<script>
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://w3c.github.io') return;
    if (e.data && e.data.type === 'wot-adopters:height') {
      document.getElementById('wot-adopters').style.height = e.data.height + 'px';
    }
  });
</script>
```

Without the script, the iframe keeps its fixed height and scrolls. For mobile, keep the iframe at `width: 100%` and make sure the host page has a viewport meta tag.
