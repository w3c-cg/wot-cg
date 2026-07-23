---
sidebar_label: Building a Consumer
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Building a Consumer

## Introduction

In the previous tutorials, we built a Thing that exposes two properties, an action, and an event over HTTP, with a Thing Description that describes all of them. So far we've been testing it by sending `curl` commands with hardcoded URLs — that's not how WoT is meant to work.

In a real WoT system, a Consumer is an application that fetches the TD first and drives all interactions from it. The TD — or its URL — is the only entry point it needs. There are no hardcoded endpoints in the Consumer's code, because the TD tells it exactly where everything is and how to reach it.

In this tutorial you'll write a Consumer that reads the initial machine state, brews a coffee, reads the updated state, and subscribes to the `lowOnWater` event — all derived from the TD at runtime.

## Setting Up

Make sure your Thing server is running (`node thing.js` in a terminal). Create a new file called `consumer.js` in the same project folder.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

Just like the Thing side uses a Servient with servers attached, the Consumer side uses a Servient with client factories — one per protocol it needs to speak. Here we only need HTTP.

```javascript
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());

servient.start().then(async (WoT) => {
  // Consumer logic goes here
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

The fetch-based Consumer needs no special setup — `fetch` is built into Node.js v18 and later. We store the TD URL in a variable; that's the only URL hardcoded in the Consumer.

```javascript
const TD_URL = "http://localhost:8080/smart-coffee-machine";

async function run() {
  // Consumer logic goes here
}

run().catch(console.error);
```

  </TabItem>
</Tabs>

## Fetching the TD

The Consumer's first step is always to fetch the TD. From that point on, all URLs and protocol details come from the TD's `forms` entries — the Consumer never constructs a URL itself.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

`WoT.requestThingDescription()` fetches and parses the TD. `WoT.consume(td)` returns a `ConsumedThing` — an object that exposes all the affordances described in the TD as method calls.

```javascript
const td = await WoT.requestThingDescription("http://localhost:8080/smart-coffee-machine");
const thing = await WoT.consume(td);
console.log(`Connected to: ${td.title}`);
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We fetch the TD as JSON. Notice that the TD URL is the only thing hardcoded — everything that follows is derived from the TD itself.

```javascript
const td = await (await fetch(TD_URL)).json();
console.log(`Connected to: ${td.title}`);
```

  </TabItem>
</Tabs>

## Reading Properties

With the TD in hand, we can read properties. With node-wot the `ConsumedThing` handles the HTTP request automatically; with fetch we look up the `href` from the TD's `forms` and request it directly.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

`readProperty()` uses the TD's forms to issue the correct HTTP request and deserialise the response. Calling `.value()` on the result gives the plain JavaScript value.

```javascript
const beans = await (await thing.readProperty("coffeeBeansLeft")).value();
const water = await (await thing.readProperty("waterLevel")).value();
console.log(`Beans: ${beans}g | Water: ${water}ml`);
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We find the correct form entry by matching the `op` field, then fetch the `href`. This is exactly what node-wot's `ConsumedThing` does internally.

```javascript
const beansForm = td.properties.coffeeBeansLeft.forms.find((f) => f.op === "readproperty");
const waterForm = td.properties.waterLevel.forms.find((f) => f.op === "readproperty");

const beans = await (await fetch(beansForm.href)).json();
const water = await (await fetch(waterForm.href)).json();
console.log(`Beans: ${beans}g | Water: ${water}ml`);
```

  </TabItem>
</Tabs>

## Invoking the Action

Invoking an action follows the same pattern — look up the form, send the request with the input, and read the response.

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

`invokeAction()` sends the input object, waits for the response, and returns it. Calling `.value()` deserialises the output into a plain JavaScript object.

```javascript
const result = await thing.invokeAction("brewCoffee", { size: "medium" });
const output = await result.value();
console.log(output.success ? output.message : `Error: ${output.message}`);

const beansAfter = await (await thing.readProperty("coffeeBeansLeft")).value();
const waterAfter = await (await thing.readProperty("waterLevel")).value();
console.log(`After brew — Beans: ${beansAfter}g | Water: ${waterAfter}ml`);
```

  </TabItem>
  <TabItem value="express" label="Express.js">

We find the action's form, then issue a `POST` with the input serialised as JSON. The `contentType` comes from the form too — the Consumer does not need to know it's `application/json` ahead of time.

```javascript
const brewForm = td.actions.brewCoffee.forms.find((f) => f.op === "invokeaction");
const result = await fetch(brewForm.href, {
  method: "POST",
  headers: { "Content-Type": brewForm.contentType },
  body: JSON.stringify({ size: "medium" }),
});
const output = await result.json();
console.log(output.success ? output.message : `Error: ${output.message}`);

const beansAfter = await (await fetch(beansForm.href)).json();
const waterAfter = await (await fetch(waterForm.href)).json();
console.log(`After brew — Beans: ${beansAfter}g | Water: ${waterAfter}ml`);
```

  </TabItem>
</Tabs>

## Subscribing to Events

Events work differently from properties and actions — instead of a request/response cycle, the Consumer maintains a persistent connection and receives notifications as they happen. Here's how to subscribe to the `lowOnWater` event:

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

`subscribeEvent()` keeps the connection open and calls the callback each time the event fires. Set this up before invoking any actions that might trigger it.

```javascript
await thing.subscribeEvent("lowOnWater", async (data) => {
  const level = await data.value();
  console.log(`Low on water: ${level}ml remaining`);
});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

The event endpoint uses [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events). In Node.js, subscribing to an SSE endpoint requires the `eventsource` package (`npm install eventsource`) — browsers have `EventSource` built in.

```javascript
const EventSource = require("eventsource");

const eventForm = td.events.lowOnWater.forms.find(f => f.op === "subscribeevent");
const es = new EventSource(eventForm.href);
es.onmessage = (event) => {
  console.log(`Low on water: ${JSON.parse(event.data)}ml remaining`);
};
```

  </TabItem>
</Tabs>

<details>
<summary>View complete <code>consumer.js</code></summary>

<Tabs>
  <TabItem value="nodewot" label="node-wot" default>

```javascript
const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());

servient.start().then(async (WoT) => {

  const td = await WoT.requestThingDescription("http://localhost:8080/smart-coffee-machine");
  const thing = await WoT.consume(td);
  console.log(`Connected to: ${td.title}`);

  await thing.subscribeEvent("lowOnWater", async (data) => {
    const level = await data.value();
    console.log(`Low on water: ${level}ml remaining`);
  });

  const beans = await (await thing.readProperty("coffeeBeansLeft")).value();
  const water = await (await thing.readProperty("waterLevel")).value();
  console.log(`Beans: ${beans}g | Water: ${water}ml`);

  for (let i = 0; i < 3; i++) {
    const result = await thing.invokeAction("brewCoffee", { size: "medium" });
    const output = await result.value();
    console.log(output.success ? output.message : `Error: ${output.message}`);
  }

  const beansAfter = await (await thing.readProperty("coffeeBeansLeft")).value();
  const waterAfter = await (await thing.readProperty("waterLevel")).value();
  console.log(`After brews — Beans: ${beansAfter}g | Water: ${waterAfter}ml`);

});
```

  </TabItem>
  <TabItem value="express" label="Express.js">

```javascript
const EventSource = require("eventsource");

const TD_URL = "http://localhost:8080/smart-coffee-machine";

async function run() {

  const td = await (await fetch(TD_URL)).json();
  console.log(`Connected to: ${td.title}`);

  const eventForm = td.events.lowOnWater.forms.find(f => f.op === "subscribeevent");
  const es = new EventSource(eventForm.href);
  es.onmessage = (event) => {
    console.log(`Low on water: ${JSON.parse(event.data)}ml remaining`);
  };

  const beansForm = td.properties.coffeeBeansLeft.forms.find((f) => f.op === "readproperty");
  const waterForm = td.properties.waterLevel.forms.find((f) => f.op === "readproperty");
  const brewForm  = td.actions.brewCoffee.forms.find((f) => f.op === "invokeaction");

  const beans = await (await fetch(beansForm.href)).json();
  const water = await (await fetch(waterForm.href)).json();
  console.log(`Beans: ${beans}g | Water: ${water}ml`);

  for (let i = 0; i < 3; i++) {
    const result = await fetch(brewForm.href, {
      method: "POST",
      headers: { "Content-Type": brewForm.contentType },
      body: JSON.stringify({ size: "medium" }),
    });
    const output = await result.json();
    console.log(output.success ? output.message : `Error: ${output.message}`);
  }

  const beansAfter = await (await fetch(beansForm.href)).json();
  const waterAfter = await (await fetch(waterForm.href)).json();
  console.log(`After brews — Beans: ${beansAfter}g | Water: ${waterAfter}ml`);

  es.close();
}

run().catch(console.error);
```

  </TabItem>
</Tabs>

</details>

## Running the Consumer

With `thing.js` running in one terminal, run the consumer in another:

```bash
node consumer.js
```

Expected output:

```
Connected to: Smart Coffee Machine
Beans: 320g | Water: 1000ml
Brewing a medium coffee
Brewing a medium coffee
Brewing a medium coffee
Low on water: 460ml remaining
After brews — Beans: 284g | Water: 460ml
```

This is the complete WoT interaction loop: the Thing describes itself, the Consumer reads that description, and all communication flows from it. The Consumer has no hardcoded knowledge of the Thing's routes — only the TD URL.

> With node-wot, the Consumer API mirrors the Thing API: `readProperty` pairs with `setPropertyReadHandler`, `invokeAction` pairs with `setActionHandler`, and `subscribeEvent` pairs with `thing.emitEvent()`. With fetch, you do the same thing manually — extracting `href` and `contentType` from the TD's forms yourself. Both approaches produce identical network requests; only the amount of boilerplate differs.

## Summary

You now have both a working Thing and a Consumer that interacts with it. In the next tutorial, we'll extend both sides together: the Thing gains CoAP and MQTT support, and the Consumer grows to select protocols from the TD.

