# WoT Adopters page

A static page listing organizations and projects that use the Web of Things.
Live at https://w3c.github.io/wot-cg/adopters/, deployed by [adopters-deploy.yml](../.github/workflows/adopters-deploy.yml) when this folder changes on `main`.

## Files

- `data/`: one file per section (`industry.yaml`, `standard-development-organizations.yaml`, `open-source.yaml`, `research.yaml`) and `bindings.yaml`
- `index.html`: page structure, section titles and "?" texts
- `styles.css`: layout and styling
- `app.js`: builds the page from `data/` and handles interaction
- `labels.js`: tile labels and initials
- `meetups.js`: loads meetup details
- `vendor/js-yaml.mjs`: YAML parser ([js-yaml](https://github.com/nodeca/js-yaml), MIT)

## Adding an adopter

Adopters can ask to be listed with the [adopter issue form](https://github.com/w3c-cg/wot-cg/issues/new?template=adopter.yml) ([source](../.github/ISSUE_TEMPLATE/adopter.yml)), linked from the page footer. To list them, add an entry to the matching file in `data/`: companies go in `industry.yaml`, universities and research institutes in `research.yaml`. Every entry is shown, so only add confirmed adopters. The "last updated" date in the footer is set on deploy from the last commit that changed `data/`, and is hidden when running locally.

```yaml
- name: Siemens                       # required
  products:                           # industry.yaml: products and/or contributions
    - title: Building X               # required
      # description: ...              # optional, shown under the title
  contributions:
    - title: node-wot
    - title: Thing Model Catalog
  meetups: [6, 12, 20, 29, 30, 31]    # optional, meetup numbers
  sources:                            # optional, evidence other than meetups
    - label: Thing Description 1.1 implementation report
      link: https://w3c.github.io/wot-thing-description/testing/report11.html
```

In `industry.yaml`, `contributions` is work given to the WoT ecosystem: open-source code, specifications, test implementations for the W3C reports and publicly funded research projects. Everything else the company offers or runs (products, services, platforms, product features, own deployments) goes under `products`; when in doubt, use `products`. Entries in the other files use a single `projects` list instead. Add `meetups`, `sources` or both as evidence where available. A trailing acronym in the name is used as the tile label, e.g. `Industrial Digital Twin Association (IDTA)` shows as `IDTA`.

Meetup titles, dates and links are read from `Meetups/<nn>/metadata.yaml` on `main`, so new meetups need no extra work here.

## Adding a binding

Add an entry to `data/bindings.yaml` with its `name` and the `link` to the binding document, taken from the Publications section of the [Binding Templates README](https://github.com/w3c/wot-binding-templates#publications). Bindings are shown in file order.

```yaml
- name: MQTT
  link: https://w3c.github.io/wot-binding-templates/bindings/protocols/mqtt/index.html
```

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
