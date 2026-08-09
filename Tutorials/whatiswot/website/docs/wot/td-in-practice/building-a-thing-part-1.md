---
sidebar_label: Building a Thing - Part 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Building a Thing - Part 1

## Introduction

So far in this series, we've covered how Thing Descriptions are structured, what Interaction Affordances are, and how Forms bind them to real network endpoints. Now it's time to put those concepts into practice by building an actual Thing.

In this tutorial you'll implement the smart coffee machine we've been using as a running example throughout the series. By the end, you'll have a running server that exposes two readable properties over HTTP and a Thing Description that describes them.

We'll build it two ways, side by side:

- **node-wot** — a reference implementation of the [WoT Scripting API](/docs/wot/building-blocks#scripting-api), provided by the Eclipse Thingweb project. It generates the Thing Description and handles all HTTP routing automatically.
- **Express.js** — a popular Node.js framework. We'll build the same Thing manually alongside it, so you can see exactly what node-wot is doing under the hood.

## What We're Building

The coffee machine will expose two read-only properties in this tutorial:

| Affordance | Type | Description |
|---|---|---|
| `coffeeBeansLeft` | Property | Amount of coffee beans remaining (grams) |
| `waterLevel` | Property | Current water level (milliliters) |

We'll add the `brewCoffee` action in the next tutorial.

## Setting Up Your Project

:::note OS differences
This tutorial assumes a Unix-like shell (macOS, Linux, or Windows Git Bash) for commands like `mkdir` and `cd`. Windows PowerShell users will need to adapt these to their equivalents (for example `New-Item -ItemType Directory` and `Set-Location`).
:::

Create a project folder and initialise it:

```bash
mkdir coffee-machine-thing
cd coffee-machine-thing
npm init -y
```

Now install the dependencies for whichever approach you're following:

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

```bash
npm install @node-wot/core @node-wot/binding-http
```

<ul>
  <li><code>@node-wot/core</code> — the WoT runtime engine</li>
  <li><code>@node-wot/binding-http</code> — the HTTP protocol binding</li>
</ul>

  </TabItem>
  <TabItem value="express" label="Express.js">

```bash
npm install express
```

<ul>
  <li><code>express</code> — the web framework we'll use to manually expose our HTTP endpoints</li>
</ul>

  </TabItem>
</Tabs>

Create a file called `thing.js` in the project folder. That's where the implementation lives.

## Defining the Properties

A property affordance in the TD carries the data schema (`type`, `minimum`, `maximum`, `readOnly`) and a `forms` array that tells Consumers how to read it. With node-wot you define this in code and the TD is generated for you; with Express you maintain it as a JavaScript object.

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

In node-wot the runtime is called a Servient. We create one, attach an HTTP server, and start it. Everything else happens inside the `.then()` callback once the runtime is ready. We call `WoT.produce()` with an object that mirrors the TD structure — node-wot registers all HTTP routes and generates the full TD automatically.

```javascript
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

let coffeeBeansLeft = 320; // grams
let waterLevel = 1000;     // milliliters

const servient = new Servient();
servient.addServer(new HttpServer({ port: 8080 }));

servient.start().then((WoT) => {
  WoT.produce({
    title: "Smart Coffee Machine",
    description: "Remote controllable coffee machine",
    id: "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
    "@context": "https://www.w3.org/2022/wot/td/v1.1",
    properties: {
      coffeeBeansLeft: {
        title: "Remaining Coffee Beans",
        type: "number",
        minimum: 0,
        maximum: 500,
        unit: "g",
        readOnly: true,
        observable: false,
      },
      waterLevel: {
        title: "Water Level",
        type: "number",
        minimum: 0,
        maximum: 1000,
        unit: "mL",
        readOnly: true,
        observable: false,
      }
    }
  }).then((thing) => {
    // Read handlers and expose go here
  });
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

With Express we declare `PORT` once at the top and reuse it in every `href` and in `app.listen()` — so changing the port is a one-line edit. We then define the TD as a JavaScript object and immediately wire up a route to serve it. The TD-serving route is the URL a Consumer fetches first to discover how to interact with the Thing.

```javascript
const express = require("express");
const app = express();
app.use(express.json());

const PORT = 8080;

let coffeeBeansLeft = 320; // grams
let waterLevel = 1000;     // milliliters

const thingDescription = {
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "description": "Remote controllable coffee machine",
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "type": "number", "minimum": 0, "maximum": 500, "unit": "g",
      "readOnly": true, "observable": false,
      "forms": [{ "href": `http://localhost:${PORT}/smart-coffee-machine/properties/coffeeBeansLeft`, "contentType": "application/json", "op": "readproperty" }]
    },
    "waterLevel": {
      "title": "Water Level",
      "type": "number", "minimum": 0, "maximum": 1000, "unit": "mL",
      "readOnly": true, "observable": false,
      "forms": [{ "href": `http://localhost:${PORT}/smart-coffee-machine/properties/waterLevel`, "contentType": "application/json", "op": "readproperty" }]
    }
  }
};

app.get("/smart-coffee-machine", (req, res) => res.json(thingDescription));
```

Any time you add a route below, you must also add a matching `forms` entry to the TD above — otherwise the TD and the server go out of sync.

  </TabItem>
</Tabs>

## Attaching Read Handlers

With the TD defined, we connect it to the actual values the properties should return.

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

`setPropertyReadHandler` runs whenever a Consumer reads that property. It simply returns the current value of the matching variable.

```javascript
thing.setPropertyReadHandler("coffeeBeansLeft", async () => coffeeBeansLeft);
thing.setPropertyReadHandler("waterLevel", async () => waterLevel);
```

  </TabItem>
  <TabItem value="express" label="Express.js">

Each property needs a `GET` route that returns its current value as JSON.

```javascript
app.get("/smart-coffee-machine/properties/coffeeBeansLeft", (req, res) => {
  res.json(coffeeBeansLeft);
});

app.get("/smart-coffee-machine/properties/waterLevel", (req, res) => {
  res.json(waterLevel);
});
```

  </TabItem>
</Tabs>

## Exposing the Thing

The last step starts the server and makes the Thing reachable on the network.

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

`thing.expose()` exposes the Thing, making its interaction affordances reachable over the network. The full TD — with all `forms` filled in automatically — is served at the root URL.

```javascript
thing.expose().then(() => {
  console.log("Thing exposed on:");
  console.log("  HTTP → http://localhost:8080/smart-coffee-machine");
});
```

:::note
node-wot derives the URL path from the `title` field: it lowercases the string and replaces spaces with hyphens. `"Smart Coffee Machine"` becomes `smart-coffee-machine`. The root URL always follows the pattern `http://[host]:[port]/[sanitized-title]`.
:::

  </TabItem>
  <TabItem value="express" label="Express.js">

`app.listen()` starts the server. The TD is already being served at the root route defined above.

```javascript
app.listen(PORT, () => {
  console.log("Thing exposed on:");
  console.log(`  HTTP → http://localhost:${PORT}/smart-coffee-machine`);
});
```

  </TabItem>
</Tabs>

<details id="complete-thing-js">
<summary>View complete <code>thing.js</code></summary>

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

```javascript
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

let coffeeBeansLeft = 320;
let waterLevel = 1000;

const servient = new Servient();
servient.addServer(new HttpServer({ port: 8080 }));

servient.start().then((WoT) => {
  WoT.produce({
    title: "Smart Coffee Machine",
    description: "Remote controllable coffee machine",
    id: "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
    "@context": "https://www.w3.org/2022/wot/td/v1.1",
    properties: {
      coffeeBeansLeft: {
        title: "Remaining Coffee Beans",
        type: "number",
        minimum: 0,
        maximum: 500,
        unit: "g",
        readOnly: true,
        observable: false,
      },
      waterLevel: {
        title: "Water Level",
        type: "number",
        minimum: 0,
        maximum: 1000,
        unit: "mL",
        readOnly: true,
        observable: false,
      }
    }
  }).then((thing) => {

    thing.setPropertyReadHandler("coffeeBeansLeft", async () => coffeeBeansLeft);
    thing.setPropertyReadHandler("waterLevel", async () => waterLevel);

    thing.expose().then(() => {
      console.log("Thing exposed on:");
      console.log("  HTTP → http://localhost:8080/smart-coffee-machine");
    });

  });
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

```javascript
const express = require("express");
const app = express();
app.use(express.json());

const PORT = 8080;

let coffeeBeansLeft = 320;
let waterLevel = 1000;

const thingDescription = {
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "description": "Remote controllable coffee machine",
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "type": "number", "minimum": 0, "maximum": 500, "unit": "g",
      "readOnly": true, "observable": false,
      "forms": [{ "href": `http://localhost:${PORT}/smart-coffee-machine/properties/coffeeBeansLeft`, "contentType": "application/json", "op": "readproperty" }]
    },
    "waterLevel": {
      "title": "Water Level",
      "type": "number", "minimum": 0, "maximum": 1000, "unit": "mL",
      "readOnly": true, "observable": false,
      "forms": [{ "href": `http://localhost:${PORT}/smart-coffee-machine/properties/waterLevel`, "contentType": "application/json", "op": "readproperty" }]
    }
  }
};

app.get("/smart-coffee-machine", (req, res) => res.json(thingDescription));
app.get("/smart-coffee-machine/properties/coffeeBeansLeft", (req, res) => res.json(coffeeBeansLeft));
app.get("/smart-coffee-machine/properties/waterLevel", (req, res) => res.json(waterLevel));

app.listen(PORT, () => {
  console.log("Thing exposed on:");
  console.log(`  HTTP → http://localhost:${PORT}/smart-coffee-machine`);
});
```

  </TabItem>
</Tabs>

</details>

<details>
<summary>View complete Thing Description</summary>

Both implementations serve the same TD. This is what a Consumer receives when it fetches `http://localhost:8080/smart-coffee-machine`:

```json
{
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "description": "Remote controllable coffee machine",
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "type": "number",
      "minimum": 0,
      "maximum": 500,
      "unit": "g",
      "readOnly": true,
      "observable": false,
      "forms": [
        {
          "href": "http://localhost:8080/smart-coffee-machine/properties/coffeeBeansLeft",
          "contentType": "application/json",
          "op": "readproperty"
        }
      ]
    },
    "waterLevel": {
      "title": "Water Level",
      "type": "number",
      "minimum": 0,
      "maximum": 1000,
      "unit": "mL",
      "readOnly": true,
      "observable": false,
      "forms": [
        {
          "href": "http://localhost:8080/smart-coffee-machine/properties/waterLevel",
          "contentType": "application/json",
          "op": "readproperty"
        }
      ]
    }
  }
}
```

</details>

## Testing Your Properties

Start the server:

```bash
node thing.js
```

You should see:
```
Thing exposed on:
  HTTP → http://localhost:8080/smart-coffee-machine
```

:::note OS differences
The `curl` commands below work on macOS, Linux, and Windows Git Bash. On Windows PowerShell, use `Invoke-WebRequest` or a GUI client.
:::

:::tip
GUI HTTP clients like [Postman](https://www.postman.com/), [Bruno](https://www.usebruno.com/), and [Insomnia](https://insomnia.rest/) are convenient alternatives to `curl` — paste the URL and inspect the response in a structured view.
:::

First, fetch the TD to confirm it describes your properties correctly:

```bash
curl http://localhost:8080/smart-coffee-machine
```

Then read each property:

```bash
curl http://localhost:8080/smart-coffee-machine/properties/coffeeBeansLeft
```

Expected: `320`

```bash
curl http://localhost:8080/smart-coffee-machine/properties/waterLevel
```

Expected: `1000`

The values match the initial state declared in code. Notice that with node-wot you never wrote the property routes — the `href` in the TD was filled in automatically by node-wot based on the server port and property name. With Express you wrote the route and the `href` yourself, so they must stay in sync manually.

## Summary

You now have a running Thing that exposes two properties over HTTP and serves its own Thing Description. The TD is the entry point — any Consumer that fetches it learns the property names, data types, constraints, and the exact URLs to read them from.

In the next tutorial, we'll extend this Thing with the `brewCoffee` action and the `lowOnWater` event, completing all three interaction affordance types.
