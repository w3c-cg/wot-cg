---
sidebar_label: Communicating with a Thing over Multiple Protocols
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Communicating with a Thing over Multiple Protocols

## Introduction

In the previous tutorial, we built a working smart coffee machine and a Consumer that interacted with it over HTTP. But one of the core promises of the Web of Things is that a Thing is not tied to any single protocol. The same affordance — reading a property, invoking an action, subscribing to an event — can be made available over HTTP, CoAP, MQTT, or any other supported protocol simultaneously.

This is exactly what Forms are for. Each affordance can have multiple forms, each pointing to a different protocol endpoint. The Consumer reads the TD, picks a form for a protocol it supports, and interacts accordingly — without the Thing ever needing to know which protocol was chosen.

In this tutorial, we'll extend both the Thing and the Consumer together:

- **HTTP** — what we already have; unchanged.
- **CoAP** — a lightweight protocol designed for constrained devices, similar to HTTP in structure but optimised for low-power networks.
- **MQTT** — a publish/subscribe protocol ideal for events, where a broker sits between the Thing and the Consumer.

By the end, the `coffeeBeansLeft` property and `brewCoffee` action will be reachable over all three protocols, the `lowOnWater` event will be implemented over MQTT, and the Consumer will subscribe to it and react in real time.

---

## What Are We Adding

| What | Change |
|---|---|
| `coffeeBeansLeft` property | Add CoAP and MQTT forms alongside the existing HTTP form |
| `brewCoffee` action | Add a CoAP form alongside the existing HTTP form |
| `lowOnWater` event | New — implemented over MQTT |
| Consumer | Grows to subscribe to the event and brew in a loop |

---

## Part 1: Installing the New Bindings

Stay in the same project folder and install the CoAP and MQTT bindings:

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

```bash
npm install @node-wot/binding-coap @node-wot/binding-mqtt
```

<ul>
  <li><code>@node-wot/binding-coap</code> — adds a CoAP server to the Servient</li>
  <li><code>@node-wot/binding-mqtt</code> — connects the Servient to an MQTT broker</li>
</ul>

For MQTT we'll use the HiveMQ public broker at `broker.hivemq.com:1883` — free, publicly hosted, no installation required.

  </TabItem>
  <TabItem value="express" label="Express.js">

```bash
npm install coap mqtt
```

<ul>
  <li><code>coap</code> — a Node.js CoAP server library</li>
  <li><code>mqtt</code> — a Node.js MQTT client library</li>
</ul>

For MQTT we'll use the HiveMQ public broker at `broker.hivemq.com:1883` — free, publicly hosted, no installation required.

  </TabItem>
</Tabs>

---

## Part 2: Updating the Thing Description

Before touching the implementation, let's look at what the updated TD will look like. Each affordance now carries multiple forms — one per protocol. A Consumer reads them all and picks whichever it supports.

Notice three important design choices here:

`coffeeBeansLeft` gets HTTP, CoAP, and MQTT forms — all for `readproperty`. `brewCoffee` gets HTTP and CoAP forms only. MQTT is intentionally excluded because invoking an action requires a request/response pattern that doesn't map naturally onto MQTT's fire-and-forget publish model. `lowOnWater` gets only an MQTT form with `subscribeevent` — MQTT's publish/subscribe model is a natural fit for events, where the Thing publishes when something happens and any subscribed Consumer is notified.

```json
{
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "securityDefinitions": { "nosec_sc": { "scheme": "nosec" } },
  "security": "nosec_sc",
  "properties": {
    "coffeeBeansLeft": {
      "type": "number", "minimum": 0, "maximum": 500, "readOnly": true,
      "forms": [
        { "href": "http://localhost:8080/smart-coffee-machine/properties/coffeeBeansLeft", "contentType": "application/json", "op": "readproperty" },
        { "href": "coap://localhost:5683/smart-coffee-machine/properties/coffeeBeansLeft", "contentType": "application/json", "op": "readproperty" },
        { "href": "mqtt://broker.hivemq.com:1883/smart-coffee-machine/properties/coffeeBeansLeft", "contentType": "application/json", "op": "readproperty" }
      ]
    },
    "waterLevel": {
      "type": "number", "minimum": 0, "maximum": 1000, "readOnly": true,
      "forms": [
        { "href": "http://localhost:8080/smart-coffee-machine/properties/waterLevel", "contentType": "application/json", "op": "readproperty" },
        { "href": "coap://localhost:5683/smart-coffee-machine/properties/waterLevel", "contentType": "application/json", "op": "readproperty" }
      ]
    }
  },
  "actions": {
    "brewCoffee": {
      "input": { "type": "object", "properties": { "size": { "type": "string", "enum": ["small","medium","large"] } }, "required": ["size"] },
      "forms": [
        { "href": "http://localhost:8080/smart-coffee-machine/actions/brewCoffee", "contentType": "application/json", "op": "invokeaction" },
        { "href": "coap://localhost:5683/smart-coffee-machine/actions/brewCoffee", "contentType": "application/json", "op": "invokeaction" }
      ]
    }
  },
  "events": {
    "lowOnWater": {
      "data": { "type": "number", "description": "Remaining water in milliliters" },
      "forms": [
        { "href": "mqtt://broker.hivemq.com:1883/smart-coffee-machine/events/lowOnWater", "contentType": "application/json", "op": "subscribeevent" }
      ]
    }
  }
}
```

With node-wot, adding a new protocol server is enough — the TD is updated automatically. With Express.js, we update this object by hand.

---

## Part 3: Updating the Thing

Open `thing.js` and update it step by step.

### Step 1: Add the new imports and state

We need to import the new protocol bindings.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

```javascript
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");
const { CoapServer } = require("@node-wot/binding-coap");
const { MqttBrokerServer } = require("@node-wot/binding-mqtt");

let coffeeBeansLeft = 320;
let waterLevel = 1000;
let isBrewing = false;
```

  </TabItem>
  <TabItem value="express" label="Express.js">

```javascript
const express = require("express");
const coap    = require("coap");
const mqtt    = require("mqtt");

const app = express();
app.use(express.json());

let coffeeBeansLeft = 320;
let waterLevel = 1000;
let isBrewing = false;
```

  </TabItem>
</Tabs>

### Step 2: Register the new protocol servers

This is the step where the two approaches diverge the most.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

We add two more `addServer()` calls. That's it. node-wot automatically generates CoAP and MQTT forms in the TD and routes requests on those protocols to the same handlers we already wrote. The handler code does not change at all.

```javascript
const servient = new Servient();
servient.addServer(new HttpServer({ port: 8080 }));
servient.addServer(new CoapServer({ port: 5683 }));
servient.addServer(new MqttBrokerServer({ uri: "mqtt://broker.hivemq.com:1883" }));

servient.start().then((WoT) => {
  // Everything else stays the same
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

With Express we have to manually create and start a CoAP server alongside the existing Express one, and connect an MQTT client for publishing events. Each needs its own setup, routing logic, and response conventions.

```javascript
// MQTT client — connects as a publisher for emitting events
const mqttClient = mqtt.connect("mqtt://broker.hivemq.com:1883");
mqttClient.on("connect", () => console.log("Connected to MQTT broker"));

// CoAP server — we route requests manually by URL and method
const coapServer = coap.createServer((req, res) => {
  // Routes defined in Step 4
});
coapServer.listen(5683, () => console.log("CoAP server on port 5683"));

// HTTP server — same as before
app.listen(8080, () => console.log("HTTP server on port 8080"));
```

  </TabItem>
</Tabs>

### Step 3: Add the `lowOnWater` event

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

We add `lowOnWater` to the events in the `WoT.produce()` call. The event carries a numeric data payload — the remaining water in milliliters.

```javascript
events: {
  lowOnWater: {
    title: "Low Water Level",
    description: "Emitted when the water level drops below 20%",
    data: { type: "number" }
  }
}
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We add `lowOnWater` to the TD object, add the corresponding HTTP and CoAP routes for `waterLevel`, and handle MQTT event publishing manually.

```javascript
// In thingDescription — add alongside coffeeBeansLeft:
"events": {
  "lowOnWater": {
    "title": "Low Water Level",
    "data": { "type": "number" },
    "forms": [
      {
        "href": "mqtt://broker.hivemq.com:1883/smart-coffee-machine/events/lowOnWater",
        "contentType": "application/json",
        "op": "subscribeevent"
      }
    ]
  }
}
```
  </TabItem>
</Tabs>

### Step 4: Update the brew logic and emit the event

The key addition here is decrementing `waterLevel` on each brew, and emitting the `lowOnWater` event when it drops below 200ml.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

We update the action handler to track water usage and call `thing.emitEvent()`. node-wot publishes this to all subscribed Consumers over MQTT automatically. The handler returns a `{success, message}` object as before — water tracking and the event emit slot in alongside the existing checks.

```javascript
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

  if (waterLevel < 200) {
    console.log("Water low — emitting event");
    thing.emitEvent("lowOnWater", waterLevel);
  }

  setTimeout(() => {
    isBrewing = false;
    console.log("Brewing complete!");
  }, 3000);

  return { success: true, message: `Brewing a ${size} coffee` };
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We extract the shared brew logic into a helper function used by both the HTTP and CoAP handlers. It returns `{success, message}` objects rather than throwing, keeping the response shape consistent with the node-wot handler. MQTT event publishing happens inside it as before.

```javascript
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

  if (waterLevel < 200) {
    console.log("Water low — publishing MQTT event");
    mqttClient.publish(
      "smart-coffee-machine/events/lowOnWater",
      JSON.stringify(waterLevel)
    );
  }

  setTimeout(() => {
    isBrewing = false;
    console.log("Brewing complete!");
  }, 3000);

  return { success: true, message: `Brewing a ${size} coffee` };
}

// HTTP brew route
app.post("/smart-coffee-machine/actions/brewCoffee", (req, res) => {
  res.json(handleBrew(req.body.size));
});

// CoAP brew route (inside the coapServer handler)
// method === "POST" && url === "/smart-coffee-machine/actions/brewCoffee"
const result = handleBrew(JSON.parse(req.payload.toString()).size);
res.code = result.success ? "2.04" : "4.00";
res.end(JSON.stringify(result));
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
const { CoapServer } = require("@node-wot/binding-coap");
const { MqttBrokerServer } = require("@node-wot/binding-mqtt");

let coffeeBeansLeft = 320;
let waterLevel = 1000;
let isBrewing = false;

const servient = new Servient();
servient.addServer(new HttpServer({ port: 8080 }));
servient.addServer(new CoapServer({ port: 5683 }));
servient.addServer(new MqttBrokerServer({ uri: "mqtt://broker.hivemq.com:1883" }));

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
        type: "number", minimum: 0, maximum: 500,
        readOnly: true, observable: false,
      },
      waterLevel: {
        title: "Water Level",
        type: "number", minimum: 0, maximum: 1000,
        readOnly: true, observable: false,
      }
    },
    actions: {
      brewCoffee: {
        title: "Brew Coffee",
        input: {
          type: "object",
          properties: { size: { type: "string", enum: ["small", "medium", "large"] } },
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
    },
    events: {
      lowOnWater: {
        title: "Low Water Level",
        description: "Emitted when water drops below 20% capacity",
        data: { type: "number" }
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

      if (waterLevel < 200) {
        console.log("Water low — emitting event");
        thing.emitEvent("lowOnWater", waterLevel);
      }

      setTimeout(() => {
        isBrewing = false;
        console.log("Brewing complete!");
      }, 3000);

      return { success: true, message: `Brewing a ${size} coffee` };
    });

    thing.expose().then(() => {
      console.log("Thing exposed on:");
      console.log("  HTTP → http://localhost:8080/smart-coffee-machine");
      console.log("  CoAP → coap://localhost:5683/smart-coffee-machine");
      console.log("  MQTT → mqtt://broker.hivemq.com:1883");
    });

  });
});
```
  </TabItem>
  <TabItem value="express" label="Express.js">

```javascript
const express = require("express");
const coap    = require("coap");
const mqtt    = require("mqtt");

const app = express();
app.use(express.json());

let coffeeBeansLeft = 320;
let waterLevel = 1000;
let isBrewing = false;

const mqttClient = mqtt.connect("mqtt://broker.hivemq.com:1883");
mqttClient.on("connect", () => console.log("Connected to MQTT broker"));

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
      "type": "number", "minimum": 0, "maximum": 500, "readOnly": true,
      "forms": [
        { "href": "http://localhost:8080/smart-coffee-machine/properties/coffeeBeansLeft", "contentType": "application/json", "op": "readproperty" },
        { "href": "coap://localhost:5683/smart-coffee-machine/properties/coffeeBeansLeft", "contentType": "application/json", "op": "readproperty" }
      ]
    },
    "waterLevel": {
      "title": "Water Level",
      "type": "number", "minimum": 0, "maximum": 1000, "readOnly": true,
      "forms": [
        { "href": "http://localhost:8080/smart-coffee-machine/properties/waterLevel", "contentType": "application/json", "op": "readproperty" },
        { "href": "coap://localhost:5683/smart-coffee-machine/properties/waterLevel", "contentType": "application/json", "op": "readproperty" }
      ]
    }
  },
  "actions": {
    "brewCoffee": {
      "title": "Brew Coffee",
      "input": { "type": "object", "properties": { "size": { "type": "string", "enum": ["small","medium","large"] } }, "required": ["size"] },
      "output": { "type": "object", "properties": { "success": { "type": "boolean" }, "message": { "type": "string" } } },
      "forms": [
        { "href": "http://localhost:8080/smart-coffee-machine/actions/brewCoffee", "contentType": "application/json", "op": "invokeaction" },
        { "href": "coap://localhost:5683/smart-coffee-machine/actions/brewCoffee", "contentType": "application/json", "op": "invokeaction" }
      ]
    }
  },
  "events": {
    "lowOnWater": {
      "title": "Low Water Level",
      "data": { "type": "number" },
      "forms": [{ "href": "mqtt://broker.hivemq.com:1883/smart-coffee-machine/events/lowOnWater", "contentType": "application/json", "op": "subscribeevent" }]
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

  if (waterLevel < 200) {
    console.log("Water low — publishing MQTT event");
    mqttClient.publish("smart-coffee-machine/events/lowOnWater", JSON.stringify(waterLevel));
  }

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

const coapServer = coap.createServer((req, res) => {
  const { url, method } = req;
  if (method === "GET" && url === "/smart-coffee-machine/properties/coffeeBeansLeft") {
    res.end(JSON.stringify(coffeeBeansLeft));
  } else if (method === "GET" && url === "/smart-coffee-machine/properties/waterLevel") {
    res.end(JSON.stringify(waterLevel));
  } else if (method === "POST" && url === "/smart-coffee-machine/actions/brewCoffee") {
    const result = handleBrew(JSON.parse(req.payload.toString()).size);
    res.code = result.success ? "2.04" : "4.00";
    res.end(JSON.stringify(result));
  } else {
    res.code = "4.04"; res.end();
  }
});

coapServer.listen(5683, () => console.log("  CoAP → coap://localhost:5683/smart-coffee-machine"));
```

  </TabItem>
</Tabs>

</details>

---

## Part 4: Growing the Consumer

Now let's update `consumer.js`. The Consumer will grow from the simple read/invoke script in tutorial 16 into a realistic application that monitors the machine, brews in a loop, and reacts to the `lowOnWater` event.

### Step 1: Add the new client factories

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

We add CoAP and MQTT client factories alongside the existing HTTP one. We also bring in `readline` for the interactive brew loop.

```javascript
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");
const { CoapClientFactory } = require("@node-wot/binding-coap");
const { MqttClientFactory } = require("@node-wot/binding-mqtt");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());
servient.addClientFactory(new CoapClientFactory());
servient.addClientFactory(new MqttClientFactory());
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We add the `mqtt` package for the event subscription and `readline` for the interactive loop. The `fetch`-based HTTP logic stays the same.

```javascript
const mqtt = require("mqtt");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const TD_URL = "http://localhost:8080/smart-coffee-machine";

function findForm(forms, op) {
  return forms.find((f) => f.op === op);
}
```

  </TabItem>
</Tabs>

### Step 2: Read the initial state

After connecting, we read both properties to get a snapshot of the machine before we start brewing.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

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

```javascript
const td = await (await fetch(TD_URL)).json();
console.log(`Connected to: ${td.title}\n`);

const beansForm = findForm(td.properties.coffeeBeansLeft.forms, "readproperty");
const waterForm = findForm(td.properties.waterLevel.forms, "readproperty");

const beans = await (await fetch(beansForm.href)).json();
const water = await (await fetch(waterForm.href)).json();
console.log(`Initial state — Beans: ${beans}g | Water: ${water}ml\n`);
```

  </TabItem>
</Tabs>

### Step 3: Subscribe to the event before brewing

We subscribe to `lowOnWater` before starting any brews so we don't miss the event if the water is already low. The callback runs whenever the Thing emits the event.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

`subscribeEvent()` finds the MQTT form in the TD, connects to the broker, and subscribes to the topic. When a message arrives, our callback is called with the event data.

```javascript
console.log("Subscribing to lowOnWater event...");
await thing.subscribeEvent("lowOnWater", async (data) => {
  const remaining = await data.value();
  console.log(`\n⚠️  LOW WATER: ${remaining}ml remaining. Refill needed!\n`);
});
console.log("Subscribed.\n");
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We read the MQTT topic directly from the TD's event form rather than hardcoding it, then subscribe using the `mqtt` package.

```javascript
const eventForm = findForm(td.events.lowOnWater.forms, "subscribeevent");
const topic = eventForm.href.split(":1883/")[1];

const mqttClient = mqtt.connect("mqtt://broker.hivemq.com:1883");
await new Promise((res) => mqttClient.on("connect", res));

mqttClient.subscribe(topic);
mqttClient.on("message", (t, msg) => {
  if (t === topic) {
    const remaining = JSON.parse(msg.toString());
    console.log(`\n⚠️  LOW WATER: ${remaining}ml remaining. Refill needed!\n`);
  }
});
console.log("Subscribed to lowOnWater.\n");
```

  </TabItem>
</Tabs>

### Step 4: Brew in a loop

The Consumer runs an interactive loop — it prompts for a size, invokes the action, reads back the water level, and handles any `{success, message}` failure gracefully. Brew four large coffees and the water drops to 40ml, triggering the event.

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
const brewForm = findForm(td.actions.brewCoffee.forms, "invokeaction");

while (true) {
  const size = await ask("Enter coffee size (small / medium / large) or 'quit' to exit: ");

  if (size === "quit") {
    rl.close();
    mqttClient.end();
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
const { CoapClientFactory } = require("@node-wot/binding-coap");
const { MqttClientFactory } = require("@node-wot/binding-mqtt");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());
servient.addClientFactory(new CoapClientFactory());
servient.addClientFactory(new MqttClientFactory());

servient.start().then(async (WoT) => {

  const td = await WoT.requestThingDescription(
    "http://localhost:8080/smart-coffee-machine"
  );
  const thing = await WoT.consume(td);
  console.log(`Connected to: ${td.title}\n`);

  const beans = await (await thing.readProperty("coffeeBeansLeft")).value();
  const water = await (await thing.readProperty("waterLevel")).value();
  console.log(`Initial state — Beans: ${beans}g | Water: ${water}ml\n`);

  console.log("Subscribing to lowOnWater event...");
  await thing.subscribeEvent("lowOnWater", async (data) => {
    const remaining = await data.value();
    console.log(`\n⚠️  LOW WATER: ${remaining}ml remaining. Refill needed!\n`);
  });
  console.log("Subscribed.\n");

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
const mqtt = require("mqtt");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const TD_URL = "http://localhost:8080/smart-coffee-machine";

function findForm(forms, op) {
  return forms.find((f) => f.op === op);
}

async function run() {

  const td = await (await fetch(TD_URL)).json();
  console.log(`Connected to: ${td.title}\n`);

  const beansForm = findForm(td.properties.coffeeBeansLeft.forms, "readproperty");
  const waterForm = findForm(td.properties.waterLevel.forms,      "readproperty");
  const brewForm  = findForm(td.actions.brewCoffee.forms,         "invokeaction");

  const beans = await (await fetch(beansForm.href)).json();
  const water = await (await fetch(waterForm.href)).json();
  console.log(`Initial state — Beans: ${beans}g | Water: ${water}ml\n`);

  const eventForm = findForm(td.events.lowOnWater.forms, "subscribeevent");
  const topic = eventForm.href.split(":1883/")[1];

  const mqttClient = mqtt.connect("mqtt://broker.hivemq.com:1883");
  await new Promise((res) => mqttClient.on("connect", res));
  mqttClient.subscribe(topic);
  mqttClient.on("message", (t, msg) => {
    if (t === topic) {
      const remaining = JSON.parse(msg.toString());
      console.log(`\n⚠️  LOW WATER: ${remaining}ml remaining. Refill needed!\n`);
    }
  });
  console.log("Subscribed to lowOnWater.\n");

  while (true) {
    const size = await ask("Enter coffee size (small / medium / large) or 'quit' to exit: ");

    if (size === "quit") {
      rl.close();
      mqttClient.end();
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

---

## Part 5: Running Everything Together

Start the Thing in one terminal:

```bash
node thing.js
```

Then open a second terminal and run the Consumer:

```bash
node consumer.js
```

You should see output like this (typing `large` four times, then `quit`):

```
Connected to: Smart Coffee Machine

Initial state — Beans: 320g | Water: 1000ml

Subscribing to lowOnWater event...
Subscribed.

Enter coffee size (small / medium / large) or 'quit' to exit: large
  ✅ Brewing a large coffee
  Water remaining: 760ml | Beans remaining: 304g

Enter coffee size (small / medium / large) or 'quit' to exit: large
  ✅ Brewing a large coffee
  Water remaining: 520ml | Beans remaining: 288g

Enter coffee size (small / medium / large) or 'quit' to exit: large
  ✅ Brewing a large coffee
  Water remaining: 280ml | Beans remaining: 272g

Enter coffee size (small / medium / large) or 'quit' to exit: large
  ✅ Brewing a large coffee
  Water remaining: 40ml | Beans remaining: 256g

⚠️  LOW WATER: 40ml remaining. Refill needed!

Enter coffee size (small / medium / large) or 'quit' to exit: quit
```

At the same time, in the Thing terminal:

```
Brewing large. Beans: 304g | Water: 760ml
Brewing large. Beans: 288g | Water: 520ml
Brewing large. Beans: 272g | Water: 280ml
Brewing large. Beans: 256g | Water: 40ml
Water low — emitting event
Brewing complete!
```

This is the complete picture: two independent applications communicating over three protocols simultaneously — HTTP for properties, CoAP available as an alternative, and MQTT carrying the event from Thing to Consumer in real time. Neither side hardcoded the other's internals. Everything flowed through the Thing Description.

---

## Next Steps

You now have a full WoT application — a Thing and Consumer growing together, decoupled through the Thing Description, communicating across three protocols.

> **Quick recap of what you built:**
> - A Thing serving HTTP, CoAP, and MQTT with no changes to its handler logic (node-wot) or a manually maintained parallel server setup (Express.js)
> - A Consumer that subscribes to an MQTT event, brews in a loop, and reacts when water runs low
> - A complete end-to-end WoT application across three protocols, with no hardcoded URLs on the Consumer side
>
> With node-wot, adding a protocol is a single `addServer()` / `addClientFactory()` call on each side. With Express.js, each protocol requires its own server, routing, and conventions — maintained in parallel with the TD.
