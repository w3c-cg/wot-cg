---
sidebar_label: Writing a Good TD
---

# Writing a Good TD

In the [previous tutorial](./writing-a-td.md), we saw which terms a Thing Description must contain. A TD with only those terms is valid, but it doesn't tell its readers much. Those readers are applications that consume the Thing and the developers who build them, so a good TD has to be clear to both.

In this tutorial, we take the minimal TD of our coffee machine and improve it step by step.

## Starting Point

This is the minimal TD from the previous tutorial:

```json
{
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "title": "Smart Coffee Machine",
  "securityDefinitions": {
    "nosec_sc": { "scheme": "nosec" }
  },
  "security": "nosec_sc",
  "properties": {
    "coffeeBeansLeft": {
      "type": "number",
      "forms": [
        { "href": "http://coffee.example.com/properties/coffeeBeansLeft" }
      ]
    }
  }
}
```

Imagine seeing it for the first time. What is `coffeeBeansLeft` measured in? Can you change it? Who do you ask when something doesn't work? The TD doesn't say.

## Step 1: Describe the Thing

Start at the top. A `description` tells readers what the Thing is, and `support` tells them who maintains this TD, as a `mailto:`, `tel:` or `https:` URI. `version` lets them see when the TD has changed, and a link to the documentation points them to more details.

```json
{
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "description": "Coffee machine that can be monitored and controlled over HTTP",
  "version": { "instance": "1.0.0" },
  "support": "mailto:td-maintainer@coffee.example.com",
  "links": [
    { "href": "https://coffee.example.com/docs", "rel": "service-doc", "type": "text/html" }
  ]
}
```

TDs are often shared widely, so the `id` shouldn't reveal anything about the Thing or its owner, such as its location or serial number. A random UUID that you generate yourself works well, and it should be possible to change it later. ([privacy-id-metadata](https://www.w3.org/TR/wot-thing-description11/#privacy-id-metadata))

## Step 2: Name and Label the Affordances

An affordance has three kinds of text, and each has a different job:

 - The **name** is the key, such as `coffeeBeansLeft`. Applications use it to address the affordance, for example `thing.readProperty("coffeeBeansLeft")` in node-wot. Keep it short, without spaces, and don't change it once the Thing is in use.
 - The **title** is a short label for people, for example the text shown in a user interface. Spaces are fine here.
 - The **description** explains what the affordance does or what the value means.

```json
"coffeeBeansLeft": {
  "title": "Remaining Coffee Beans",
  "description": "Amount of coffee beans left in the container",
  ...
}
```

Write titles and descriptions as plain text, without HTML ([sec-inj-no-intl-markup](https://www.w3.org/TR/wot-thing-description11/#sec-inj-no-intl-markup)), and so that they still make sense when read aloud, for example by a screen reader.

If your TD is used in more than one language, set the default language with `@language` and add translations with `titles` and `descriptions`. Use the same set of languages everywhere in the TD. ([td-multi-languages-consistent](https://www.w3.org/TR/wot-thing-description11/#td-multi-languages-consistent))

```json
"@context": ["https://www.w3.org/2022/wot/td/v1.1", { "@language": "en" }],
"title": "Smart Coffee Machine",
"titles": { "en": "Smart Coffee Machine", "de": "Intelligente Kaffeemaschine" }
```

## Step 3: Describe the Data

`"type": "number"` on its own doesn't tell a Consumer the unit, the range, or whether it may write the value. Add what applies:

```json
"coffeeBeansLeft": {
  "title": "Remaining Coffee Beans",
  "description": "Amount of coffee beans left in the container",
  "type": "number",
  "unit": "g",
  "minimum": 0,
  "maximum": 500,
  "readOnly": true,
  ...
}
```

For a fixed set of values, use `enum` instead of listing the options in the description:

```json
"size": { "type": "string", "enum": ["small", "medium", "large"] }
```

## Step 4: Make the Interactions Explicit

Many terms have [default values](./writing-a-td.md#defaults) that apply when you leave them out. A Consumer knows them, but a person reading your TD may not. Write out the ones that matter, especially `op` and `contentType`.

```json
"forms": [
  {
    "href": "properties/coffeeBeansLeft",
    "op": "readproperty",
    "contentType": "application/json"
  }
]
```

This is more than a matter of style. A property form without `op` allows both reading and writing, even if you only meant to offer reading. ([td-default-op-properties](https://www.w3.org/TR/wot-thing-description11/#td-default-op-properties))

## Step 5: Describe the Security

The TD says which security mechanism the Thing uses, never the credentials themselves. Passwords, API keys and tokens don't belong in a TD. ([td-security-no-secrets](https://www.w3.org/TR/wot-thing-description11/#td-security-no-secrets))

```json
"securityDefinitions": {
  "basic_sc": { "scheme": "basic", "in": "header" }
},
"security": "basic_sc"
```

Declare exactly the schemes the Thing requires. A Consumer relies on this information to connect, so a TD that lists `nosec` for a Thing that actually needs a password is simply wrong.

## Step 6: Check It

Paste your TD into the [Thingweb Playground](https://playground.thingweb.io/). Besides checking that the TD is valid, it can add all default values to your TD for you, which is a quick way to see what your TD means when terms are left out.

## Result

Here is our coffee machine after all the steps:

```json
{
  "@context": ["https://www.w3.org/2022/wot/td/v1.1", { "@language": "en" }],
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "description": "Coffee machine that can be monitored and controlled over HTTP",
  "version": { "instance": "1.0.0" },
  "support": "mailto:td-maintainer@coffee.example.com",
  "base": "http://coffee.example.com/",
  "securityDefinitions": {
    "basic_sc": { "scheme": "basic", "in": "header" }
  },
  "security": "basic_sc",
  "properties": {
    "coffeeBeansLeft": {
      "title": "Remaining Coffee Beans",
      "description": "Amount of coffee beans left in the container",
      "type": "number",
      "unit": "g",
      "minimum": 0,
      "maximum": 500,
      "readOnly": true,
      "forms": [
        {
          "href": "properties/coffeeBeansLeft",
          "op": "readproperty",
          "contentType": "application/json"
        }
      ]
    }
  },
  "links": [
    { "href": "https://coffee.example.com/docs", "rel": "service-doc", "type": "text/html" }
  ]
}
```

## Checklist

Not all of these are required by the specification. Terms like `description`, `version` and `support` are optional, but they make the TD much easier to use.

 - The Thing has a `description`, a `version`, and says who maintains the TD (`support`).
 - The `id` is random and reveals nothing about the Thing or its owner.
 - Affordance names are short and stable, and every affordance has a `title` and a `description`.
 - The default language is set, and translations cover the same languages everywhere.
 - Every value has a `type`, and a `unit`, range, `enum` or `readOnly` where they apply.
 - Every form states its `op` and `contentType`.
 - The security schemes match what the Thing requires, and there are no credentials in the TD.
 - The TD passes validation in the Playground.
