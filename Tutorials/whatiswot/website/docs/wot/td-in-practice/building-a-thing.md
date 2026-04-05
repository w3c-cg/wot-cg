---
sidebar_label: Building a Thing
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Building a Thing

## Introduction

So far in this series, we've covered the core concepts of the Web of Things: what a Thing Description is, how Interaction Affordances work, and how Forms and protocol bindings connect abstract operations to real network traffic. Now it's time to put it all into practice.

In this tutorial, you'll build a working smart coffee machine — the same example we've been using throughout the series — from scratch. By the end, you'll have a running Thing that exposes a property and an action, and a Consumer application that interacts with it.

We'll show you two ways to build it, running side by side:

- **node-wot** — the official W3C implementation of the WoT standard, built by the Eclipse Thingweb team. It takes care of generating the Thing Description, exposing your affordances over HTTP, and handling all the WoT interaction patterns automatically — so you can focus on your application logic instead of networking details.
- **Express.js** — a popular Node.js web framework that many developers already know. We'll build the same Thing manually alongside it, so you can see exactly what node-wot is doing under the hood and understand why it is worth using.

---

## What We're Building

Our smart coffee machine will expose the following interaction affordances in this tutorial:

| Affordance | Type | Description |
|---|---|---|
| `coffeeBeansLeft` | Property | Returns the amount of coffee beans remaining (grams) |
| `waterLevel` | Property | Returns the current water level (milliliters) |
| `brewCoffee` | Action | Starts brewing a cup of coffee (small / medium / large) |

Multi-protocol support and the `lowOnWater` event will be added in the next tutorial.

---

## Part 1: Setting Up Your Project

Create a new folder for your project and initialize it:

```bash
mkdir coffee-machine-thing
cd coffee-machine-thing
```

Now install the dependencies for whichever approach you're following:

<Tabs>
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

---

## Part 2: Defining the Thing Description

Before writing any implementation code, it helps to know what our Thing Description will look like. This is the contract between our Thing and any Consumer that wants to interact with it.

The TD describes three affordances. The `coffeeBeansLeft` and `waterLevel` properties are both read-only and return numbers. The `brewCoffee` action takes an input object with a `size` field that must be one of `"small"`, `"medium"`, or `"large"`, and returns an output object with a `success` flag and a `message` string. Each affordance has a `forms` entry specifying the HTTP endpoint, content type, and WoT operation a Consumer should use.

With node-wot, this TD is generated automatically from your code. With Express.js, you write and maintain it by hand.

<details>
<summary> Here's the full TD we're aiming to produce: </summary>

```json
{
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "description": "Remote controllable coffee machine",
  "securityDefinitions": { "nosec_sc": { "scheme": "nosec" } },
  "security": "nosec_sc",
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "type": "number",
      "minimum": 0,
      "maximum": 500,
      "readOnly": true,
      "observable": false,
      "forms": [{
        "href": "http://localhost:8080/smart-coffee-machine/properties/coffeeBeansLeft",
        "contentType": "application/json",
        "op": "readproperty"
      }]
    },
    "waterLevel": {
      "title": "Water Level",
      "type": "number",
      "minimum": 0,
      "maximum": 1000,
      "readOnly": true,
      "observable": false,
      "forms": [{
        "href": "http://localhost:8080/smart-coffee-machine/properties/waterLevel",
        "contentType": "application/json",
        "op": "readproperty"
      }]
    }
  },
  "actions": {
    "brewCoffee": {
      "title": "Brew Coffee",
      "input": {
        "type": "object",
        "properties": {
          "size": { "type": "string", "enum": ["small", "medium", "large"] }
        },
        "required": ["size"]
      },
      "output": {
        "type": "object",
        "properties": {
          "success": { "type": "boolean" },
          "message": { "type": "string" }
        }
      },
      "forms": [{
        "href": "http://localhost:8080/smart-coffee-machine/actions/brewCoffee",
        "contentType": "application/json",
        "op": "invokeaction"
      }]
    }
  }
}
```
</details>

---

## Part 3: Implementing the Thing

Create a file called `thing.js` in your project folder. We'll build it up step by step.

### Step 1: Set up the runtime and internal state

The first thing we need is some internal state — variables representing the physical state of the machine — and a runtime to host our Thing.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

In node-wot the runtime is called a Servient. It manages your Things and protocol bindings. We create one, attach an HTTP server, and start it. Everything else happens inside the `.then()` callback once the runtime is ready.

```javascript
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

let coffeeBeansLeft = 320; // grams
let waterLevel = 1000;     // milliliters
let isBrewing = false;

const servient = new Servient();
servient.addServer(new HttpServer({ port: 8080 }));

servient.start().then((WoT) => {
  // Thing definition goes here
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

With Express we create an app instance and enable JSON body parsing so incoming request bodies are automatically parsed. Our state variables sit at the top alongside it.

```javascript
const express = require("express");
const app = express();
app.use(express.json());

let coffeeBeansLeft = 320; // grams
let waterLevel = 1000;     // milliliters
let isBrewing = false;
```

  </TabItem>
</Tabs>

### Step 2: Define the Thing and its affordances

Next we describe the Thing structure. This is where the two approaches differ most significantly.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

We call `WoT.produce()` with a JavaScript object that mirrors the TD structure. node-wot uses this to generate the full TD and set up all HTTP routing automatically — we never write a single route.

```javascript
WoT.produce({
  title: "Smart Coffee Machine",
  description: "Remote controllable coffee machine",
  id: "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  securityDefinitions: { nosec_sc: { scheme: "nosec" } },
  security: "nosec_sc",
  properties: {
    coffeeBeansLeft: {
      title: "Remaining Coffee Beans",
      type: "number",
      minimum: 0,
      maximum: 500,
      readOnly: true,
      observable: false,
    },
    waterLevel: {
      title: "Water Level",
      type: "number",
      minimum: 0,
      maximum: 1000,
      readOnly: true,
      observable: false,
    }
  },
  actions: {
    brewCoffee: {
      title: "Brew Coffee",
      input: {
        type: "object",
        properties: {
          size: { type: "string", enum: ["small", "medium", "large"] }
        },
        required: ["size"]
      },
      output: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          message: { type: "string" }
        }
      }
    }
  }
}).then((thing) => {
  // Handlers go here
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

With Express we define the TD as a JavaScript object and maintain it manually. We also immediately wire up a route to serve it — this is the URL a Consumer fetches first to discover how to interact with the Thing. Any time we add or change a route below, we must update this object too or the TD and the server go out of sync.

```javascript
const thingDescription = {
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "description": "Remote controllable coffee machine",
  "securityDefinitions": { "nosec_sc": { "scheme": "nosec" } },
  "security": "nosec_sc",
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "type": "number", "minimum": 0, "maximum": 500,
      "readOnly": true, "observable": false,
      "forms": [{ "href": "http://localhost:8080/smart-coffee-machine/properties/coffeeBeansLeft", "contentType": "application/json", "op": "readproperty" }]
    },
    "waterLevel": {
      "title": "Water Level",
      "type": "number", "minimum": 0, "maximum": 1000,
      "readOnly": true, "observable": false,
      "forms": [{ "href": "http://localhost:8080/smart-coffee-machine/properties/waterLevel", "contentType": "application/json", "op": "readproperty" }]
    }
  },
  "actions": {
    "brewCoffee": {
      "title": "Brew Coffee",
      "input": { "type": "object", "properties": { "size": { "type": "string", "enum": ["small","medium","large"] } }, "required": ["size"] },
      "output": { "type": "object", "properties": { "success": { "type": "boolean" }, "message": { "type": "string" } } },
      "forms": [{ "href": "http://localhost:8080/smart-coffee-machine/actions/brewCoffee", "contentType": "application/json", "op": "invokeaction" }]
    }
  }
};

app.get("/smart-coffee-machine", (req, res) => res.json(thingDescription));
```

  </TabItem>
</Tabs>

### Step 3: Attach handlers

Now we connect our internal state to the affordances. Each handler is a function that runs when a Consumer triggers the corresponding operation.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

`setPropertyReadHandler` runs when a Consumer reads the property — it simply returns the current value. `setActionHandler` runs when a Consumer invokes the action — it receives the input, checks the machine's state, and returns a `{success, message}` object.

```javascript
thing.setPropertyReadHandler("coffeeBeansLeft", async () => coffeeBeansLeft);
thing.setPropertyReadHandler("waterLevel", async () => waterLevel);

thing.setActionHandler("brewCoffee", async (params) => {
  const input = await params.value();
  const size = input?.size;

  const beanUsage  = { small: 8,   medium: 12,  large: 16  };
  const waterUsage = { small: 120, medium: 180, large: 240 };

  if (isBrewing) {
    console.log("Brew rejected: machine is already brewing");
    return { success: false, message: "already brewing" };
  }

  if (coffeeBeansLeft < beanUsage[size]) {
    console.log(`Brew rejected: not enough beans (${coffeeBeansLeft}g left, need ${beanUsage[size]}g)`);
    return { success: false, message: "Not enough coffee beans" };
  }

  if (waterLevel < waterUsage[size]) {
    console.log(`Brew rejected: not enough water (${waterLevel}ml left, need ${waterUsage[size]}ml)`);
    return { success: false, message: "Not enough water" };
  }

  isBrewing        = true;
  coffeeBeansLeft -= beanUsage[size];
  waterLevel      -= waterUsage[size];

  console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);

  setTimeout(() => {
    isBrewing = false;
    console.log("Brewing complete!");
  }, 3000);

  return { success: true, message: `Brewing a ${size} coffee` };
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

With Express we write explicit routes. The properties are `GET` routes that return values directly. The action is a `POST` that reads the body, validates the input, and returns a `{success, message}` JSON object — mirroring what the node-wot handler returns. We use a shared `handleBrew()` helper so the logic stays in one place.

```javascript
app.get("/smart-coffee-machine/properties/coffeeBeansLeft", (req, res) => {
  res.json(coffeeBeansLeft);
});

app.get("/smart-coffee-machine/properties/waterLevel", (req, res) => {
  res.json(waterLevel);
});

function handleBrew(size) {
  const beanUsage  = { small: 8,   medium: 12,  large: 16  };
  const waterUsage = { small: 120, medium: 180, large: 240 };

  if (isBrewing) {
    console.log("Brew rejected: machine is already brewing");
    return { success: false, message: "already brewing" };
  }

  if (!["small", "medium", "large"].includes(size)) {
    return { success: false, message: "Invalid size" };
  }

  if (coffeeBeansLeft < beanUsage[size]) {
    console.log(`Brew rejected: not enough beans (${coffeeBeansLeft}g left, need ${beanUsage[size]}g)`);
    return { success: false, message: "Not enough coffee beans" };
  }

  if (waterLevel < waterUsage[size]) {
    console.log(`Brew rejected: not enough water (${waterLevel}ml left, need ${waterUsage[size]}ml)`);
    return { success: false, message: "Not enough water" };
  }

  isBrewing        = true;
  coffeeBeansLeft -= beanUsage[size];
  waterLevel      -= waterUsage[size];

  console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);

  setTimeout(() => {
    isBrewing = false;
    console.log("Brewing complete!");
  }, 3000);

  return { success: true, message: `Brewing a ${size} coffee` };
}

app.post("/smart-coffee-machine/actions/brewCoffee", (req, res) => {
  const { size } = req.body;
  res.json(handleBrew(size));
});
```

  </TabItem>
</Tabs>

### Step 4: Expose the Thing

The last step is to make the Thing available on the network.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

`thing.expose()` starts the HTTP server and publishes the Thing. The full TD — with all forms filled in — becomes available at the root URL automatically.

```javascript
thing.expose().then(() => {
  console.log("Thing exposed on:");
  console.log("  HTTP → http://localhost:8080/smart-coffee-machine");
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

`app.listen()` starts the Express server. The TD is already being served at the root route we set up in Step 2.

```javascript
app.listen(8080, () => {
  console.log("Thing exposed on:");
  console.log("  HTTP → http://localhost:8080/smart-coffee-machine");
});
```

  </TabItem>
</Tabs>

### Full `thing.js`

<details>
<summary>View complete <code>thing.js</code></summary>

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

```javascript
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

let coffeeBeansLeft = 320;
let waterLevel = 1000;
let isBrewing = false;

const servient = new Servient();
servient.addServer(new HttpServer({ port: 8080 }));

servient.start().then((WoT) => {
  WoT.produce({
    title: "Smart Coffee Machine",
    description: "Remote controllable coffee machine",
    id: "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
    "@context": "https://www.w3.org/2022/wot/td/v1.1",
    securityDefinitions: { nosec_sc: { scheme: "nosec" } },
    security: "nosec_sc",
    properties: {
      coffeeBeansLeft: {
        title: "Remaining Coffee Beans",
        type: "number",
        minimum: 0,
        maximum: 500,
        readOnly: true,
        observable: false,
      },
      waterLevel: {
        title: "Water Level",
        type: "number",
        minimum: 0,
        maximum: 1000,
        readOnly: true,
        observable: false,
      }
    },
    actions: {
      brewCoffee: {
        title: "Brew Coffee",
        input: {
          type: "object",
          properties: {
            size: { type: "string", enum: ["small", "medium", "large"] }
          },
          required: ["size"]
        },
        output: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" }
          }
        }
      }
    }
  }).then((thing) => {

    thing.setPropertyReadHandler("coffeeBeansLeft", async () => coffeeBeansLeft);
    thing.setPropertyReadHandler("waterLevel", async () => waterLevel);

    thing.setActionHandler("brewCoffee", async (params) => {
      const input = await params.value();
      const size = input?.size;

      const beanUsage  = { small: 8,   medium: 12,  large: 16  };
      const waterUsage = { small: 120, medium: 180, large: 240 };

      if (isBrewing) {
        console.log("Brew rejected: machine is already brewing");
        return { success: false, message: "already brewing" };
      }

      if (coffeeBeansLeft < beanUsage[size]) {
        console.log(`Brew rejected: not enough beans (${coffeeBeansLeft}g left, need ${beanUsage[size]}g)`);
        return { success: false, message: "Not enough coffee beans" };
      }

      if (waterLevel < waterUsage[size]) {
        console.log(`Brew rejected: not enough water (${waterLevel}ml left, need ${waterUsage[size]}ml)`);
        return { success: false, message: "Not enough water" };
      }

      isBrewing        = true;
      coffeeBeansLeft -= beanUsage[size];
      waterLevel      -= waterUsage[size];

      console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);

      setTimeout(() => {
        isBrewing = false;
        console.log("Brewing complete!");
      }, 3000);

      return { success: true, message: `Brewing a ${size} coffee` };
    });

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

let coffeeBeansLeft = 320;
let waterLevel = 1000;
let isBrewing = false;

const thingDescription = {
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "description": "Remote controllable coffee machine",
  "securityDefinitions": { "nosec_sc": { "scheme": "nosec" } },
  "security": "nosec_sc",
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "type": "number", "minimum": 0, "maximum": 500,
      "readOnly": true, "observable": false,
      "forms": [{ "href": "http://localhost:8080/smart-coffee-machine/properties/coffeeBeansLeft", "contentType": "application/json", "op": "readproperty" }]
    },
    "waterLevel": {
      "title": "Water Level",
      "type": "number", "minimum": 0, "maximum": 1000,
      "readOnly": true, "observable": false,
      "forms": [{ "href": "http://localhost:8080/smart-coffee-machine/properties/waterLevel", "contentType": "application/json", "op": "readproperty" }]
    }
  },
  "actions": {
    "brewCoffee": {
      "title": "Brew Coffee",
      "input": { "type": "object", "properties": { "size": { "type": "string", "enum": ["small","medium","large"] } }, "required": ["size"] },
      "output": { "type": "object", "properties": { "success": { "type": "boolean" }, "message": { "type": "string" } } },
      "forms": [{ "href": "http://localhost:8080/smart-coffee-machine/actions/brewCoffee", "contentType": "application/json", "op": "invokeaction" }]
    }
  }
};

function handleBrew(size) {
  const beanUsage  = { small: 8,   medium: 12,  large: 16  };
  const waterUsage = { small: 120, medium: 180, large: 240 };

  if (isBrewing) {
    console.log("Brew rejected: machine is already brewing");
    return { success: false, message: "already brewing" };
  }

  if (!["small", "medium", "large"].includes(size)) {
    return { success: false, message: "Invalid size" };
  }

  if (coffeeBeansLeft < beanUsage[size]) {
    console.log(`Brew rejected: not enough beans (${coffeeBeansLeft}g left, need ${beanUsage[size]}g)`);
    return { success: false, message: "Not enough coffee beans" };
  }

  if (waterLevel < waterUsage[size]) {
    console.log(`Brew rejected: not enough water (${waterLevel}ml left, need ${waterUsage[size]}ml)`);
    return { success: false, message: "Not enough water" };
  }

  isBrewing        = true;
  coffeeBeansLeft -= beanUsage[size];
  waterLevel      -= waterUsage[size];

  console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);

  setTimeout(() => {
    isBrewing = false;
    console.log("Brewing complete!");
  }, 3000);

  return { success: true, message: `Brewing a ${size} coffee` };
}

app.get("/smart-coffee-machine", (req, res) => res.json(thingDescription));
app.get("/smart-coffee-machine/properties/coffeeBeansLeft", (req, res) => res.json(coffeeBeansLeft));
app.get("/smart-coffee-machine/properties/waterLevel", (req, res) => res.json(waterLevel));
app.post("/smart-coffee-machine/actions/brewCoffee", (req, res) => {
  res.json(handleBrew(req.body.size));
});

app.listen(8080, () => {
  console.log("Thing exposed on:");
  console.log("  HTTP → http://localhost:8080/smart-coffee-machine");
});
```

  </TabItem>
</Tabs>

</details>

---

## Part 4: Testing Your Thing with a Request

Start your server:

```bash
node thing.js
```

You should see:
```
Thing exposed on:
  HTTP → http://localhost:8080/smart-coffee-machine
```

:::note OS differences
The `curl` commands below work on macOS, Linux, and Windows Git Bash. On Windows PowerShell, use `Invoke-WebRequest` or append `| Select-Object -Expand Content` to get raw JSON output.
:::

```bash
curl http://localhost:8080/smart-coffee-machine
```

**Read the property:**

```bash
curl http://localhost:8080/smart-coffee-machine/properties/coffeeBeansLeft
```

Expected: `320`

**Invoke the action:**

<Tabs>
  <TabItem value="macos-linux" label="macOS / Linux" default>

```bash
curl -X POST http://localhost:8080/smart-coffee-machine/actions/brewCoffee \
  -H "Content-Type: application/json" \
  -d '{"size": "medium"}'
```

  </TabItem>
  <TabItem value="windows" label="Windows (PowerShell)">

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/smart-coffee-machine/actions/brewCoffee" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"size": "medium"}'
```

  </TabItem>
</Tabs>

The response will be `{"success":true,"message":"Brewing a medium coffee"}`. Your server terminal should show `Brewing medium. Beans: 308g | Water: 820ml`.

:::tip

Verify the state changed by reading the properties again — beans should now be `308` and water `820`.

:::

---

## Part 5: Your First Consumer

So far we've been using `curl` to interact with the Thing manually. In a real WoT system, a Consumer is an application that fetches the TD and uses it to drive all interactions — no hardcoded URLs or protocol details. The TD URL is the only entry point it needs.

Create a new file called `consumer.js` in the same project folder.

### Step 1: Set up the Consumer runtime

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

Just like the Thing side uses a Servient with servers, the Consumer side uses a Servient with client factories — one per protocol it wants to support. Here we only need HTTP. We also set up `readline` to accept input from the terminal.

```javascript
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());

servient.start().then(async (WoT) => {
  // Consumer logic goes here
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

The fetch-based Consumer needs no special setup — `fetch` is built into modern Node.js (v18+). We use `readline` for terminal input and define the TD URL as our single entry point.

```javascript
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const TD_URL = "http://localhost:8080/smart-coffee-machine";

async function run() {
  // Consumer logic goes here
}

run().catch(console.error);
```

  </TabItem>
</Tabs>

### Step 2: Fetch the TD and connect

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

`WoT.requestThingDescription()` fetches the TD. `WoT.consume(td)` parses it and returns a `ConsumedThing` — an object that exposes all the affordances described in the TD. We then read both properties to print the machine's initial state.

```javascript
const td = await WoT.requestThingDescription(
  "http://localhost:8080/smart-coffee-machine"
);
const thing = await WoT.consume(td);
console.log(`Connected to: ${td.title}\n`);

const beans = await (await thing.readProperty("coffeeBeansLeft")).value();
const water = await (await thing.readProperty("waterLevel")).value();
console.log(`Initial state — Beans: ${beans}g | Water: ${water}ml\n`);
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We fetch the TD and read both properties to print the initial state.

```javascript
const td = await (await fetch(TD_URL)).json();
console.log(`Connected to: ${td.title}\n`);

const beansForm = td.properties.coffeeBeansLeft.forms.find((f) => f.op === "readproperty");
const waterForm = td.properties.waterLevel.forms.find((f) => f.op === "readproperty");

const beans = await (await fetch(beansForm.href)).json();
const water = await (await fetch(waterForm.href)).json();
console.log(`Initial state — Beans: ${beans}g | Water: ${water}ml\n`);
```

  </TabItem>
</Tabs>

### Step 3: Invoke an action in a loop

Rather than a one-shot brew, the Consumer runs an interactive loop — it prompts for a size, invokes the action, and prints the machine's state after each brew. The action returns a `{success, message}` object, so the Consumer can display a specific message for each failure case.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

```javascript
while (true) {
  const size = await ask("Enter coffee size (small / medium / large) or 'quit' to exit: ");

  if (size === "quit") {
    rl.close();
    break;
  }

  if (!["small", "medium", "large"].includes(size)) {
    console.log("  Invalid size. Please enter small, medium, or large.\n");
    continue;
  }

  const result = await thing.invokeAction("brewCoffee", { size });
  const output = await result.value();

  if (!output.success) {
    if (output.message.includes("Not enough water")) {
      console.log("  ❌ Not enough water to brew. Please refill the machine.\n");
    } else if (output.message.includes("Not enough coffee beans")) {
      console.log("  ❌ Not enough coffee beans. Please refill the machine.\n");
    } else if (output.message.includes("already brewing")) {
      console.log("  ⏳ The machine is already brewing, please wait.\n");
    } else {
      console.log(`  ❌ Could not brew: ${output.message}\n`);
    }
  } else {
    console.log(`  ✅ ${output.message}`);
    await new Promise((res) => setTimeout(res, 500));

    const currentWater = await (await thing.readProperty("waterLevel")).value();
    const currentBeans = await (await thing.readProperty("coffeeBeansLeft")).value();
    console.log(`  Water remaining: ${currentWater}ml | Beans remaining: ${currentBeans}g\n`);
  }
}

process.exit(0);
```

  </TabItem>
  <TabItem value="express" label="Express.js">

```javascript
const brewForm = td.actions.brewCoffee.forms.find((f) => f.op === "invokeaction");

while (true) {
  const size = await ask("Enter coffee size (small / medium / large) or 'quit' to exit: ");

  if (size === "quit") {
    rl.close();
    break;
  }

  if (!["small", "medium", "large"].includes(size)) {
    console.log("  Invalid size. Please enter small, medium, or large.\n");
    continue;
  }

  const result = await fetch(brewForm.href, {
    method: "POST",
    headers: { "Content-Type": brewForm.contentType },
    body: JSON.stringify({ size }),
  });
  const output = await result.json();

  if (!output.success) {
    if (output.message.includes("Not enough water")) {
      console.log("  ❌ Not enough water to brew. Please refill the machine.\n");
    } else if (output.message.includes("Not enough coffee beans")) {
      console.log("  ❌ Not enough coffee beans. Please refill the machine.\n");
    } else if (output.message.includes("already brewing")) {
      console.log("  ⏳ The machine is already brewing, please wait.\n");
    } else {
      console.log(`  ❌ Could not brew: ${output.message}\n`);
    }
  } else {
    console.log(`  ✅ ${output.message}`);
    await new Promise((res) => setTimeout(res, 500));

    const currentWater = await (await fetch(waterForm.href)).json();
    const currentBeans = await (await fetch(beansForm.href)).json();
    console.log(`  Water remaining: ${currentWater}ml | Beans remaining: ${currentBeans}g\n`);
  }
}

process.exit(0);
```

  </TabItem>
</Tabs>

### Full `consumer.js`

<details>
<summary>View complete <code>consumer.js</code></summary>

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

```javascript
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());

servient.start().then(async (WoT) => {

  const td = await WoT.requestThingDescription(
    "http://localhost:8080/smart-coffee-machine"
  );
  const thing = await WoT.consume(td);
  console.log(`Connected to: ${td.title}\n`);

  const beans = await (await thing.readProperty("coffeeBeansLeft")).value();
  const water = await (await thing.readProperty("waterLevel")).value();
  console.log(`Initial state — Beans: ${beans}g | Water: ${water}ml\n`);

  while (true) {
    const size = await ask("Enter coffee size (small / medium / large) or 'quit' to exit: ");

    if (size === "quit") {
      rl.close();
      break;
    }

    if (!["small", "medium", "large"].includes(size)) {
      console.log("  Invalid size. Please enter small, medium, or large.\n");
      continue;
    }

    const result = await thing.invokeAction("brewCoffee", { size });
    const output = await result.value();

    if (!output.success) {
      if (output.message.includes("Not enough water")) {
        console.log("  ❌ Not enough water to brew. Please refill the machine.\n");
      } else if (output.message.includes("Not enough coffee beans")) {
        console.log("  ❌ Not enough coffee beans. Please refill the machine.\n");
      } else if (output.message.includes("already brewing")) {
        console.log("  ⏳ The machine is already brewing, please wait.\n");
      } else {
        console.log(`  ❌ Could not brew: ${output.message}\n`);
      }
    } else {
      console.log(`  ✅ ${output.message}`);
      await new Promise((res) => setTimeout(res, 500));

      const currentWater = await (await thing.readProperty("waterLevel")).value();
      const currentBeans = await (await thing.readProperty("coffeeBeansLeft")).value();
      console.log(`  Water remaining: ${currentWater}ml | Beans remaining: ${currentBeans}g\n`);
    }
  }

  process.exit(0);

});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

```javascript
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const TD_URL = "http://localhost:8080/smart-coffee-machine";

async function run() {

  const td = await (await fetch(TD_URL)).json();
  console.log(`Connected to: ${td.title}\n`);

  const beansForm = td.properties.coffeeBeansLeft.forms.find((f) => f.op === "readproperty");
  const waterForm = td.properties.waterLevel.forms.find((f) => f.op === "readproperty");
  const brewForm  = td.actions.brewCoffee.forms.find((f) => f.op === "invokeaction");

  const beans = await (await fetch(beansForm.href)).json();
  const water = await (await fetch(waterForm.href)).json();
  console.log(`Initial state — Beans: ${beans}g | Water: ${water}ml\n`);

  while (true) {
    const size = await ask("Enter coffee size (small / medium / large) or 'quit' to exit: ");

    if (size === "quit") {
      rl.close();
      break;
    }

    if (!["small", "medium", "large"].includes(size)) {
      console.log("  Invalid size. Please enter small, medium, or large.\n");
      continue;
    }

    const result = await fetch(brewForm.href, {
      method: "POST",
      headers: { "Content-Type": brewForm.contentType },
      body: JSON.stringify({ size }),
    });
    const output = await result.json();

    if (!output.success) {
      if (output.message.includes("Not enough water")) {
        console.log("  ❌ Not enough water to brew. Please refill the machine.\n");
      } else if (output.message.includes("Not enough coffee beans")) {
        console.log("  ❌ Not enough coffee beans. Please refill the machine.\n");
      } else if (output.message.includes("already brewing")) {
        console.log("  ⏳ The machine is already brewing, please wait.\n");
      } else {
        console.log(`  ❌ Could not brew: ${output.message}\n`);
      }
    } else {
      console.log(`  ✅ ${output.message}`);
      await new Promise((res) => setTimeout(res, 500));

      const currentWater = await (await fetch(waterForm.href)).json();
      const currentBeans = await (await fetch(beansForm.href)).json();
      console.log(`  Water remaining: ${currentWater}ml | Beans remaining: ${currentBeans}g\n`);
    }
  }

  process.exit(0);

}

run().catch(console.error);
```

  </TabItem>
</Tabs>

</details>

Make sure your Thing is running (`node thing.js` in another terminal), then run:

```bash
node consumer.js
```

Expected output (typing `medium` then `quit`):

```
Connected to: Smart Coffee Machine

Initial state — Beans: 320g | Water: 1000ml

Enter coffee size (small / medium / large) or 'quit' to exit: medium
  ✅ Brewing a medium coffee
  Water remaining: 820ml | Beans remaining: 308g

Enter coffee size (small / medium / large) or 'quit' to exit: quit
```

This is the complete WoT interaction loop: the Thing describes itself, the Consumer reads that description, and all communication flows from it. The Consumer has no hardcoded knowledge of the Thing's internals — only the TD URL.

---

## Next Steps

You now have both a working Thing and a Consumer that interacts with it. In the next tutorial, we'll extend both sides together: the Thing gains CoAP and MQTT support, and the Consumer grows to select protocols from the TD and subscribe to the `lowOnWater` event in real time.

> **Quick recap of what you built:**
> - A Thing exposing two properties and an action over HTTP, with a TD generated automatically
> - An action that returns structured `{success, message}` responses rather than bare HTTP status codes
> - A Consumer that fetches the TD, reads initial state, and runs an interactive brew loop — no hardcoded URLs
>
> With node-wot, the Consumer API mirrors the Thing API: `readProperty`/`setPropertyReadHandler`, `invokeAction`/`setActionHandler`. With fetch, you do the same thing manually — extracting `href` and `contentType` from the TD's forms yourself.
