---
sidebar_label: Introduction
---

import useBaseUrl from '@docusaurus/useBaseUrl';

# Thing Description

<iframe width="100%" height="400" src="https://www.youtube.com/embed/traPzBmeuSo?si=fxN3PdWKUdz9LXk8" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

If YouTube does not work, <a href = "https://github.com/w3c/wot-cg/blob/main/Tutorials/whatiswot/13-Thing_Description/13-Thing-Description.mp4">click here to watch from our GitHub repository.</a>  

In this tutorial, we will provide a general overview of a fundamental concept in the Web of Things — the Thing Description, or TD. A TD acts as a unique blueprint for the respective Thing, offering a standardized way to describe its functionality and how a Consumer should interact with it.

:::info
As shown in [Figure 1](#fig-consumer-definition), a Consumer is any application or service that communicates with a Thing over the network using its Thing Description. It understands the TD and uses it to interact with the Thing.
:::

<figure id="fig-consumer-definition">
  <img src={useBaseUrl('/img/13-Thing-Description/consumer.png')} alt="Consumer definition diagram" />
  <figcaption><strong>Figure 1.</strong> The relationship between Consumer, Thing and Thing Description.</figcaption>
</figure>

Thing Descriptions are written using the JSON-LD format, making it readable by both machines and humans. To understand this better, let's take a look at a simple example — a smart coffee machine — and break down the components in its Thing Description:

```json
{
    "@context": [
        "https://www.w3.org/2022/wot/td/v1.1",
        {
            "schema": "https://schema.org/"
        }
    ], 
    "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
    "title": "Smart Coffee Machine",
    "description" : "Remote controllable coffee machine",
    "schema:manufacturer":"ACME Corporation",
    "securityDefinitions": { ... },
    "security": { ... },
    "properties": {
        "coffeeBeansLeft": { ... }
    },
    "actions": {
        "brewCoffee": { ... }
    },
    "events": {
        "lowOnWater": { ... }
    },
    "links": [{
        "rel": "controlledBy",
        "href": "https://servient.example.com/things/machineController",
        "type": "application/td+json"
    }]
}
```
## TD Components

:::info
For a more in-depth look at each TD component, you can explore [the official documentation](https://www.w3.org/TR/2023/REC-wot-thing-description11-20231205/). Additionally, our upcoming tutorials will cover each of these components in detail.
:::

### Thing Metadata

The Thing Description begins with the Thing's metadata. It provides the essential information about the device, like its unique ID, title, and description.

```json
    "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
    "title": "Smart Coffee Machine",
    "description" : "Remote controllable coffee machine",
```

### Definition of Interaction Affordances

In the definitions of Interaction Affordances, we specify ways a Consumer application can interact with the Thing, through the various properties, actions, and events exposed on its network interfaces.

```json
    "properties": {
        "coffeeBeansLeft": { ... }
    },
    "actions": {
        "brewCoffee": { ... }
    },
    "events": {
        "lowOnWater": { ... }
    }
```

The example here shows the property `coffeeBeansLeft`, which describes the current state of the coffee beans; the action `brewCoffee`, which triggers brewing; and the event `lowOnWater`, which alerts the Consumer when the machine is low on water. We’ll explore Interaction Affordances in greater detail in the next tutorial of this series. 

### Security Metadata

The Security Metadata defines security mechanisms required to ensure authorized and secure interactions with the Thing by the Consumer application. This way the Consumer application knows what type of credentials are needed to execute different operations.

```json
    "securityDefinitions": { ... },
    "security": { ... }
```

### Semantic Annotations

To add keywords that are not part of the TD standard, Semantic Annotations can be added. These allow other systems to consistently interpret the device’s terms and functions.

Here, we annotate using `schema.org` to add the name of the manufacturer, which is not part of the core TD specification.

```json
{
    "@context": [
        "https://www.w3.org/2022/wot/td/v1.1",
        {
            "schema": "https://schema.org/"
        }
    ],
    ...
    "schema:manufacturer": "ACME Corporation"
}
```

### Links to other documents

Finally, the Thing Description can be linked to other documents, such as documentation or a user interface. In this example, the links array specifies that the Thing can be controlled by an external machine controller at the given URL.

```json
    "links": [{
        "rel": "controlledBy",
        "href": "https://servient.example.com/things/machineController",
        "type": "application/td+json"
    }]
```

## Overview

This overview should give you a solid foundation for understanding the role of Thing Descriptions in the Web of Things. The next tutorials will explain the components in greater detail.