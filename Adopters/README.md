# WoT Adopters page

A static page listing organizations and projects that use the Web of Things.
Live at https://w3c.github.io/wot-cg/adopters/, deployed by [adopters-deploy.yml](../.github/workflows/adopters-deploy.yml) when this folder changes on `main`.

## Files

- `data/`: the adopter lists, one file per section, and `bindings.yaml`
- `index.html`: page structure, section titles and "?" texts
- `styles.css`: layout and styling
- `app.js`: builds the page from `data/` and handles interaction
- `labels.js`: tile labels and initials
- `meetups.js`: loads meetup details
- `vendor/js-yaml.mjs`: YAML parser ([js-yaml](https://github.com/nodeca/js-yaml), MIT)

## Adding an adopter

Add an entry to the matching file in `data/`. Every entry is shown, so only add confirmed adopters. The "last updated" date in the footer is set on deploy from the last commit that changed `data/`, and is hidden when running locally.

```yaml
- name: Siemens                       # required
  type: Company                       # companies.yaml only: Company or Research
  projects:                           # required, at least one
    - title: node-wot                 # required
      # description: ...              # optional, shown under the title
    - title: Building X
  meetups: [20, 29, 30, 31]           # optional, meetup numbers
  sources:                            # optional, evidence other than meetups
    - label: Thing Description 1.1 implementation report
      link: https://w3c.github.io/wot-thing-description/testing/report11.html
```

Each entry needs `meetups`, `sources` or both. A trailing acronym in the name is used as the tile label, e.g. `Industrial Digital Twin Association (IDTA)` shows as `IDTA`.

Meetup titles, dates and links are read from `Meetups/<nn>/metadata.yaml` on `main`, so new meetups need no extra work here.

## Adding a binding

Add a `- name: ...` line to `data/bindings.yaml`. Bindings are shown in file order.

## Checking your changes

Check your changes with `node scripts/validate-adopters-yaml.js` (run `npm ci` in `scripts/` first). The same check runs on pull requests.

To preview the page, serve this folder, e.g. `python -m http.server` in `Adopters/`, and open http://localhost:8000. Opening `index.html` directly doesn't work because the browser blocks loading `data/`.

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
