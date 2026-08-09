---
sidebar_label: Building a Thing - Part 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Building a Thing - Part 2

## Introduction

In the previous tutorial, we built a Thing that exposes two read-only properties over HTTP. Now we'll extend it with the remaining two interaction affordance types: an action and an event.

As we covered in the [Interaction Affordances](/docs/wot/td/interaction-affordances) tutorial:

- **Actions** represent operations that change state or trigger a process. They accept input and return a structured response.
- **Events** are asynchronous notifications pushed from the Thing to interested Consumers. Unlike properties and actions — which follow a request/response cycle — events maintain a persistent connection and notify Consumers as things happen.

## What We're Adding

| Affordance | Type | Description |
|---|---|---|
| `brewCoffee` | Action | Brews a coffee of a given size, deducting beans and water |
| `lowOnWater` | Event | Emitted when the water level drops below 500 ml |

Open [`thing.js` from the previous tutorial](/docs/wot/td-in-practice/building-a-thing-part-1#complete-thing-js) — we'll extend it step by step.

## Adding the Action

### Extending the TD

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

Inside the `WoT.produce()` call, add an `actions` section after `properties`:

```javascript
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
```

node-wot reads this schema and registers an HTTP `POST` endpoint for the action automatically — no route needed.

  </TabItem>
  <TabItem value="express" label="Express.js">

Inside the `thingDescription` object, add an `"actions"` section after `"properties"`:

```javascript
"actions": {
  "brewCoffee": {
    "title": "Brew Coffee",
    "input": {
      "type": "object",
      "properties": { "size": { "type": "string", "enum": ["small", "medium", "large"] } },
      "required": ["size"]
    },
    "output": {
      "type": "object",
      "properties": { "success": { "type": "boolean" }, "message": { "type": "string" } }
    },
    "forms": [{ "href": `http://localhost:${PORT}/smart-coffee-machine/actions/brewCoffee`, "contentType": "application/json", "op": "invokeaction" }]
  }
}
```

Unlike node-wot, adding the action to the TD object has no effect on its own — you also need to register the route below.

  </TabItem>
</Tabs>

### Implementing the Handler

The handler checks whether there are enough beans and water for the requested size, deducts them if so, and returns a `{ success, message }` object either way. Returning a structured response — rather than relying on HTTP error codes — lets the Consumer display a specific message for each failure case.

> To keep things simple in this tutorial, brewing happens instantly. The handler returns as soon as the resources are deducted.

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

`setActionHandler` works the same way as `setPropertyReadHandler` — you name the affordance and supply an async function. The handler receives the input as a `params` object; calling `await params.value()` deserialises it into a plain JavaScript object.

```javascript
thing.setActionHandler("brewCoffee", async (params) => {
  const input = await params.value();
  const size = input?.size;

  const beanUsage  = { small: 8,   medium: 12,  large: 16  };
  const waterUsage = { small: 120, medium: 180, large: 240 };

  if (coffeeBeansLeft < beanUsage[size]) {
    console.log(`Brew rejected: not enough beans (${coffeeBeansLeft}g left, need ${beanUsage[size]}g)`);
    return { success: false, message: "Not enough coffee beans" };
  }

  if (waterLevel < waterUsage[size]) {
    console.log(`Brew rejected: not enough water (${waterLevel}ml left, need ${waterUsage[size]}ml)`);
    return { success: false, message: "Not enough water" };
  }

  coffeeBeansLeft -= beanUsage[size];
  waterLevel      -= waterUsage[size];

  console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);
  return { success: true, message: `Brewing a ${size} coffee` };
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We write a `handleBrew()` function with the logic and wire it to a `POST` route. Keeping the logic separate from the route makes both easier to read.

```javascript
function handleBrew(size) {
  const beanUsage  = { small: 8,   medium: 12,  large: 16  };
  const waterUsage = { small: 120, medium: 180, large: 240 };

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

  coffeeBeansLeft -= beanUsage[size];
  waterLevel      -= waterUsage[size];

  console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);
  return { success: true, message: `Brewing a ${size} coffee` };
}

app.post("/smart-coffee-machine/actions/brewCoffee", (req, res) => {
  res.json(handleBrew(req.body.size));
});
```

  </TabItem>
</Tabs>

## Adding the Event

HTTP has no built-in push mechanism — unlike MQTT, where publish/subscribe is the foundation, or CoAP, which has an Observe option built in. To support events over HTTP, the WoT HTTP binding uses subprotocols: the `subprotocol` field on an event's form tells the Consumer which mechanism the server is using. Here we use long polling, where the Consumer holds a GET request open until the event fires. In protocols with native eventing, this field is not needed.

### Extending the TD

The `lowOnWater` event carries a `data` schema — the value the Thing sends when the event fires. Here it's the current water level, so the Consumer knows exactly how much is left.

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

Add an `events` section to the `WoT.produce()` call, alongside `actions`:

```javascript
events: {
  lowOnWater: {
    title: "Low on Water",
    description: "Emitted when the water level drops below 500 ml.",
    data: { type: "number", minimum: 0, maximum: 1000 }
  }
}
```

node-wot automatically creates a long polling endpoint for the event and fills in the corresponding `forms` entry in the generated TD — no extra routing code required.

  </TabItem>
  <TabItem value="express" label="Express.js">

Add an `"events"` section to the `thingDescription` object:

```javascript
"events": {
  "lowOnWater": {
    "title": "Low on Water",
    "description": "Emitted when the water level drops below 500 ml.",
    "data": { "type": "number", "minimum": 0, "maximum": 1000 },
    "forms": [{
      "href": `http://localhost:${PORT}/smart-coffee-machine/events/lowOnWater`,
      "contentType": "application/json",
      "subprotocol": "longpoll",
      "op": "subscribeevent"
    }]
  }
}
```

  </TabItem>
</Tabs>

### Emitting the Event

The `lowOnWater` event should fire whenever brewing leaves the water level below 500 ml. We add that check inside the brew logic, right after deducting water.

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

First add `const LOW_WATER = 500;` at the top of `thing.js`, alongside `coffeeBeansLeft` and `waterLevel`. Then add the threshold check inside `setActionHandler`, after updating `waterLevel`:

```javascript
coffeeBeansLeft -= beanUsage[size];
waterLevel      -= waterUsage[size];

if (waterLevel < LOW_WATER) {
  thing.emitEvent("lowOnWater", waterLevel);
  console.log(`Low water event emitted: ${waterLevel}ml remaining`);
}

console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);
return { success: true, message: `Brewing a ${size} coffee` };
```

`thing.emitEvent()` sends the payload to all subscribed Consumers over the long polling connection that node-wot manages automatically.

  </TabItem>
  <TabItem value="express" label="Express.js">

For Express, we use long polling — the Consumer sends a GET request that the server holds open until the event fires, then responds with the payload and closes the connection. The Consumer immediately re-polls to wait for the next event.

Add `const LOW_WATER = 500;` at the top of `thing.js` alongside the other constants. Then add the poller list and long polling route:

```javascript
const pollers = [];

app.get("/smart-coffee-machine/events/lowOnWater", (req, res) => {
  pollers.push(res);
  req.on("close", () => {
    pollers.splice(pollers.indexOf(res), 1);
  });
});
```

Then update `handleBrew()` to emit the event after deducting water:

```javascript
coffeeBeansLeft -= beanUsage[size];
waterLevel      -= waterUsage[size];

if (waterLevel < LOW_WATER) {
  const waiting = pollers.splice(0);
  waiting.forEach(res => res.json(waterLevel));
  console.log(`Low water event emitted: ${waterLevel}ml remaining`);
}

console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);
return { success: true, message: `Brewing a ${size} coffee` };
```

This mirrors what node-wot handles for you automatically — holding the connection open and responding when the event fires.

  </TabItem>
</Tabs>

<details>
<summary>View complete <code>thing.js</code></summary>

<Tabs groupId="implementation">
  <TabItem value="nodewot" label="node-wot" default>

```javascript
const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

let coffeeBeansLeft = 320;
let waterLevel = 1000;

const LOW_WATER = 500;

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
    },
    events: {
      lowOnWater: {
        title: "Low on Water",
        description: "Emitted when the water level drops below 500 ml.",
        data: { type: "number", minimum: 0, maximum: 1000 }
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

      if (coffeeBeansLeft < beanUsage[size]) {
        console.log(`Brew rejected: not enough beans (${coffeeBeansLeft}g left, need ${beanUsage[size]}g)`);
        return { success: false, message: "Not enough coffee beans" };
      }

      if (waterLevel < waterUsage[size]) {
        console.log(`Brew rejected: not enough water (${waterLevel}ml left, need ${waterUsage[size]}ml)`);
        return { success: false, message: "Not enough water" };
      }

      coffeeBeansLeft -= beanUsage[size];
      waterLevel      -= waterUsage[size];

      if (waterLevel < LOW_WATER) {
        thing.emitEvent("lowOnWater", waterLevel);
        console.log(`Low water event emitted: ${waterLevel}ml remaining`);
      }

      console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);
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

const PORT = 8080;
const LOW_WATER = 500;

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
  },
  "actions": {
    "brewCoffee": {
      "title": "Brew Coffee",
      "input": {
        "type": "object",
        "properties": { "size": { "type": "string", "enum": ["small", "medium", "large"] } },
        "required": ["size"]
      },
      "output": {
        "type": "object",
        "properties": { "success": { "type": "boolean" }, "message": { "type": "string" } }
      },
      "forms": [{ "href": `http://localhost:${PORT}/smart-coffee-machine/actions/brewCoffee`, "contentType": "application/json", "op": "invokeaction" }]
    }
  },
  "events": {
    "lowOnWater": {
      "title": "Low on Water",
      "description": "Emitted when the water level drops below 500 ml.",
      "data": { "type": "number", "minimum": 0, "maximum": 1000 },
      "forms": [{
        "href": `http://localhost:${PORT}/smart-coffee-machine/events/lowOnWater`,
        "contentType": "application/json",
        "subprotocol": "longpoll",
        "op": "subscribeevent"
      }]
    }
  }
};

const pollers = [];

function handleBrew(size) {
  const beanUsage  = { small: 8,   medium: 12,  large: 16  };
  const waterUsage = { small: 120, medium: 180, large: 240 };

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

  coffeeBeansLeft -= beanUsage[size];
  waterLevel      -= waterUsage[size];

  if (waterLevel < LOW_WATER) {
    const waiting = pollers.splice(0);
    waiting.forEach(res => res.json(waterLevel));
    console.log(`Low water event emitted: ${waterLevel}ml remaining`);
  }

  console.log(`Brewing ${size}. Beans: ${coffeeBeansLeft}g | Water: ${waterLevel}ml`);
  return { success: true, message: `Brewing a ${size} coffee` };
}

app.get("/smart-coffee-machine", (req, res) => res.json(thingDescription));
app.get("/smart-coffee-machine/properties/coffeeBeansLeft", (req, res) => res.json(coffeeBeansLeft));
app.get("/smart-coffee-machine/properties/waterLevel", (req, res) => res.json(waterLevel));
app.post("/smart-coffee-machine/actions/brewCoffee", (req, res) => {
  res.json(handleBrew(req.body.size));
});
app.get("/smart-coffee-machine/events/lowOnWater", (req, res) => {
  pollers.push(res);
  req.on("close", () => {
    pollers.splice(pollers.indexOf(res), 1);
  });
});

app.listen(PORT, () => {
  console.log("Thing exposed on:");
  console.log(`  HTTP → http://localhost:${PORT}/smart-coffee-machine`);
});
```

  </TabItem>
</Tabs>

</details>

## Testing

Restart the server:

```bash
node thing.js
```

:::note OS differences
The `curl` commands below work on macOS, Linux, and Windows Git Bash. On Windows PowerShell, use `Invoke-WebRequest` or a GUI client.
:::

### Testing the Action

:::tip
GUI HTTP clients like [Postman](https://www.postman.com/), [Bruno](https://www.usebruno.com/), and [Insomnia](https://insomnia.rest/) are especially convenient for POST requests — you can set the body, send, and inspect the response without constructing a curl command.
:::

<Tabs groupId="implementation">
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

Expected response: `{"success":true,"message":"Brewing a medium coffee"}`

Your server terminal will log: `Brewing medium. Beans: 308g | Water: 820ml`

### Triggering the Event

The `lowOnWater` event fires when water drops below 500 ml. Starting from 1000 ml, three medium brews use 540 ml total, leaving 460 ml.

To observe the event in real time, open a second terminal and open a long poll **before** brewing:

```bash
curl http://localhost:8080/smart-coffee-machine/events/lowOnWater
```

The request will hang until the event fires. Then brew three medium coffees in your first terminal. On the third brew, the long poll responds and you'll see the payload in the second terminal:

```
460
```

Your server terminal will also log: `Low water event emitted: 460ml remaining`

## Summary

The coffee machine now exposes all three interaction affordance types: properties that describe its state, an action that changes it, and an event that notifies Consumers when something important happens. The TD describes all three — what data each interaction accepts, what it returns, and the exact URLs to use.
