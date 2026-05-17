---
sidebar_label: Interaction Affordances
---

import useBaseUrl from '@docusaurus/useBaseUrl';

# Interaction Affordances

<iframe width="100%" height="400" src="https://www.youtube.com/embed/_YnBpXXHL6c?si=pnTTY5ROvvLdVPhN" title="YouTube tutorial player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

If YouTube does not work, <a href = "https://github.com/w3c/wot-cg/blob/main/Tutorials/whatiswot/14-Interaction_Affordances/14-Interaction-Affordances.mp4">click here to watch from our GitHub repository.</a>  

In this tutorial, we’re going to dive deeper into Thing Descriptions by exploring one of their core concepts — Interaction Affordances. As we previously learned, a TD serves as a description of the possible interactions with a device or service, defined as Interaction Affordances.

## Types of Interaction Affordances

An Interaction Affordance is one of three types: a property, an action, or an event. An affordance is defined not only by its semantic role, but by accompanying metadata, such as interaction metadata, made up of a data schema describing the input and output structure, and forms specifying protocol bindings.

<figure id="fig-interaction-affordances">
  <img src={useBaseUrl('/img/14-Interaction-Affordances/interaction_affordances.png')} alt="Types of Interaction Affordances" />
  <figcaption><strong>Figure 1.</strong> The different types of interaction affordances.</figcaption>
</figure>

To understand this better, we'll expand on the example from the last tutorial. This is a snippet of the interaction affordances of a smart coffee machine. How an affordance is actually activated — e.g., via a network request — will be covered in a later tutorial.


``` json
{
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "description": "Amount of remaining coffee beans in grams",
      "type": "number",
      "minimum": 0,
      "maximum": 500,
      "readOnly": true,
      "observable": false,
      "forms": [ ... ]
    }
  },
  "actions": {
    "brewCoffee": {
      "title": "Brew Coffee",
      "description": "Starts brewing a cup of coffee",
      "input": {
        "type": "object",
        "properties": {
          "size": {
            "type": "string",
            "enum": ["small", "medium", "large"]
          }
        }
      },
      "safe": false,
      "idempotent": false,
      "synchronous": true,
      "forms": [ ... ]
    }
  },
  "events": {
    "lowOnWater": { 
        "title": "Low Water Level",
        "forms": [ ... ]
    }
  }
}

```

### Properties

Properties define the state, sensor values, or configuration parameters of a Thing. They can be read, observed, or written to. 

```json
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "description": "Amount of remaining coffee beans in grams",
      "type": "number",
      "minimum": 0,
      "maximum": 500,
      "readOnly": true,
      "observable": false,
      "forms": [ ... ]
    }
  }
```

In our example, `coffeeBeansLeft` is a property that returns the number of grams of coffee beans remaining in the machine. This property can be read, but neither observed nor written to.

### Actions

Actions define operations that a Consumer application can trigger. These are used when something needs to happen within the Thing, like starting a process or performing a task.


```json
  "actions": {
    "brewCoffee": {
      "title": "Brew Coffee",
      "description": "Starts brewing a cup of coffee",
      "input": {
        "type": "object",
        "properties": {
          "size": {
            "type": "string",
            "enum": ["small", "medium", "large"]
          }
        }
      },
      "safe": false,
      "idempotent": false,
      "synchronous": true,
      "forms": [ ... ]
    }
  }
```

For instance, `brewCoffee` is an action that starts brewing a cup of coffee. It takes an input — the volume of coffee to brew — and is invoked by the Consumer.

### Events

Events represent notifications that a Thing emits to the subscribers of the event, often asynchronously. These are used for real-time updates or alerts.

```json
  "events": {
    "lowOnWater": { 
        "title": "Low Water Level",
        "forms": [ ... ]
    }
  }
```

In this case, `lowOnWater` is an event triggered when the water level is low. A Consumer can subscribe to this event and be notified when it occurs. This event definition currently has no data field, meaning it simply signals that the condition occured. However, events can also carry data — for example, `lowOnWater` could include the exact volume of water remaining in milliliters.

## Interaction Metadata

Each affordance includes interaction metadata, which provide context about how it can be used, including the following:

 - title and description: these are human-readable labels

```json
      "title": "Remaining Coffee Beans",
      "description": "Amount of remaining coffee beans in grams"
```

- flags: only applicable to properties; such as `readOnly`, `writeOnly`, or `observable`

```json
      "readOnly": true,
      "observable": false
```
- subtypes: applicable to actions; may be `safe`, `idempotent`, or `synchronous`

```json
      "safe": false,
      "idempotent": false,
      "synchronous": true
```

This metadata ensures clients know how to interact with the affordance over the network.

:::info

Alongside the given examples, there are additional, more technical forms of interaction metadata, which we will introduce and explain in future tutorials, once the fundamentals are clear.

:::

## Data 

Interaction affordances also define data schemas that describe the structure of inputs and outputs. These schemas use JSON Schema — as introduced in our preliminary series — to define data types, allowed values, and nested structures. In our example, the `brewCoffee` action expects an input object with a size property, which must be either "`small`", "`medium`", or "`large`".

```json
  "actions": {
    "brewCoffee": {
      "title": "Brew Coffee",
      "description": "Starts brewing a cup of coffee",
      // highlight-start
      "input": {
        "type": "object",
        "properties": {
          "size": {
            "type": "string",
            "enum": ["small", "medium", "large"]
          }
        }
      },
      // highlight-end
      "safe": false,
      "idempotent": false,
      "synchronous": true,
      "forms": [ ... ]
    }
  }
```

Any interaction affordance can also have structured data, regardless of its type: for example we can add a numeric value describing the remaining water in milliliters to the event lowOnWater.

```json
"events": {
    "lowOnWater": { 
        "title": "Low Water Level",
        // highlight-start
        "data": {
            "type": "number",
            "description": "Amount of water remaining in ml"
        },
        // highlight-end
        "forms": [ ... ]
    }
  }
```

Similarly, the property coffeeBeansLeft can specify a number between 0 and 500 representing the grams of beans available.

```json
"properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "description": "Amount of remaining coffee beans in grams",
      // highlight-start
      "type": "number",
      "minimum": 0,
      "maximum": 500,
      // highlight-end
      "readOnly": true,
      "observable": false,
      "forms": [ ... ]
    }
  }
```    

Data schemas are crucial for validation, tooling, and interoperability. So when you’re authoring a Thing Description, make sure to clearly describe your data to ensure it can be interpreted correctly.

## Summary

That wraps up this tutorial. In the next tutorial, we’ll dive deeper into protocol bindings and learn exactly how to interact with a Thing over the network.
