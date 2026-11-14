---
sidebar_label: Writing a TD - Cheatsheet
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Writing a Thing Description

In the previous tutorials, we looked at how a Thing Description is structured, what Interaction Affordances are, and how forms connect them to the network. In this tutorial, we put it all together into a reference you can keep open while writing your own TD.

We start with the minimal TD, the few terms every Thing Description needs. After that comes a cheatsheet of every term you can use, followed by a few recipes for common tasks.

:::info
This page covers **Thing Description 1.1** and only lists the terms you need when writing a TD. The full list of rules is in the [specification](https://www.w3.org/TR/wot-thing-description11/) and the [TD 1.1 Implementation Report](https://w3c.github.io/wot-thing-description/testing/report11.html).
:::

## The Minimal Thing Description

This is the smallest useful TD: our coffee machine with a single property. The highlighted lines are mandatory.

```json {2-7,11-13}
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

 - `@context` marks the document as a TD 1.1. If you add other vocabularies later, turn it into an array and keep the TD URI first.
 - `title` is a human-readable name for the Thing.
 - `securityDefinitions` declares security schemes and `security` activates them. Both are needed even if the Thing has no authentication, which is what the `nosec` scheme is for.
 - Properties, actions and events are optional, but every affordance needs at least one form, and every form needs an `href`.
 - Save the file as UTF-8 without a byte order mark (BOM). Some editors add one without asking. [↗](https://www.w3.org/TR/wot-thing-description11/#td-json-open_utf-8) [↗](https://www.w3.org/TR/wot-thing-description11/#td-json-open_no-byte-order)

:::tip
Paste the example into the [Thingweb Playground](https://playground.thingweb.io/), remove one of the highlighted lines and see what error you get.
:::

## Anatomy of a Full TD

Here is a richer version of the same coffee machine. Each part is explained in the cheatsheet below.

```json
{
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "id": "urn:uuid:0804d572-cce8-422a-bb7c-4412fcd56f06",
  "title": "Smart Coffee Machine",
  "base": "http://coffee.example.com/",
  "version": { "instance": "1.0.0" },
  "securityDefinitions": {
    "basic_sc": { "scheme": "basic", "in": "header" }
  },
  "security": "basic_sc",
  "properties": {
    "coffeeBeansLeft": {
      "type": "number",
      "unit": "g",
      "minimum": 0,
      "readOnly": true,
      "forms": [{ "href": "properties/coffeeBeansLeft", "op": "readproperty" }]
    }
  },
  "actions": {
    "brewCoffee": {
      "input": { "type": "string", "enum": ["espresso", "latte"] },
      "idempotent": false,
      "forms": [{ "href": "actions/brewCoffee", "contentType": "application/json" }]
    }
  },
  "events": {
    "lowOnWater": {
      "data": { "type": "integer", "unit": "ml" },
      "forms": [{ "href": "events/lowOnWater", "subprotocol": "longpoll" }]
    }
  },
  "links": [{
    "href": "https://servient.example.com/things/machineController",
    "rel": "controlledBy",
    "type": "application/td+json"
  }]
}
```

Jump to: [Thing](#thing) · [Version](#versioninfo) · [Affordances](#affordances) · [Form](#form) · [Data Schema](#dataschema) · [Security](#security) · [Link](#link) · [Defaults](#defaults)

## Cheatsheet

Each section covers one part of the TD. Terms are marked as Required, Optional or Conditional (required only in some cases). Use the **Required only** tab on a table to see just its mandatory terms.

### Thing {#thing}

The top-level object of every TD. See [Thing](https://www.w3.org/TR/wot-thing-description11/#thing) in the specification.

<Tabs>
  <TabItem value="all" label="All terms (22)" default>

| Term | Type | Required | Description |
|---|---|---|---|
| `@context` | anyURI or Array | Required | Marks the document as a TD 1.1. Extra vocabularies (e.g. `schema.org`) are added as prefix objects in the array.<details><summary>⚠️ Watch out</summary>Must include the TD 1.1 URI. If you also include the TD 1.0 URI, it comes first. Add `{"@language": "en"}` to set the default language. [↗](https://www.w3.org/TR/wot-thing-description11/#td-context-ns-thing-mandatory) [↗](https://www.w3.org/TR/wot-thing-description11/#td-context-ns-td10-namespace) [↗](https://www.w3.org/TR/wot-thing-description11/#td-context-default-language)</details> |
| `title` | string | Required | Human-readable name of the Thing. |
| `securityDefinitions` | Map of SecurityScheme | Required | Named security configurations that `security` and forms can refer to.<details><summary>⚠️ Watch out</summary>A definition has no effect until its name is used in a `security` member. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-securityDefinitions--Thing)</details> |
| `security` | string or Array of string | Required | Names of the `securityDefinitions` that apply to every form by default. All listed names must be satisfied.<details><summary>⚠️ Watch out</summary>Required even for an open Thing (use `nosec`). Every name must exist in `securityDefinitions`. To combine schemes, use `combo` instead of an array. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-mandatory) [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-security--Thing) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-combo-deprecation)</details> |
| `id` | anyURI | Optional | Unique identifier of the Thing, typically a `urn:uuid:…`.<details><summary>⚠️ Watch out</summary>Use a random UUID without information about the Thing or its owner, and only include what readers need. [↗](https://www.w3.org/TR/wot-thing-description11/#privacy-distributed-ids) [↗](https://www.w3.org/TR/wot-thing-description11/#privacy-id-metadata) [↗](https://www.w3.org/TR/wot-thing-description11/#privacy-essential-metadata-only)</details> |
| `@type` | string or Array of string | Optional | Semantic class of the Thing, e.g. `saref:CoffeeMachine`. |
| `description` | string | Optional | Human-readable description of the Thing. |
| `titles` | Map of MultiLanguage | Optional | Translations of `title`, keyed by language tag (`{"de": "Kaffeemaschine"}`).<details><summary>⚠️ Watch out</summary>Keys are BCP 47 tags (`en`, `de-AT`). Every `title` should have a matching entry, and every `titles`/`descriptions` should list the same languages. For right-to-left text, set `@direction` in `@context`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-multilanguage-language-tag) [↗](https://www.w3.org/TR/wot-thing-description11/#td-titles-descriptions) [↗](https://www.w3.org/TR/wot-thing-description11/#td-multi-languages-consistent) [↗](https://www.w3.org/TR/wot-thing-description11/#td-text-at-direction) [↗](https://www.w3.org/TR/wot-thing-description11/#td-producer-mixed-direction)</details> |
| `descriptions` | Map of MultiLanguage | Optional | Translations of `description`, keyed by language tag. |
| `base` | anyURI | Optional | Base URI that relative form `href` values are resolved against.<details><summary>⚠️ Watch out</summary>Without `base`, every `href` must be absolute. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-base--Thing)</details> |
| `properties` | Map of PropertyAffordance | Optional | The Thing's properties (state that can be read, written or observed). |
| `actions` | Map of ActionAffordance | Optional | The Thing's actions (functions that can be invoked). |
| `events` | Map of EventAffordance | Optional | The Thing's events (notifications pushed to subscribers). |
| `forms` | Array of Form | Optional | Operations on the whole Thing, e.g. `readallproperties`.<details><summary>⚠️ Watch out</summary>Each form must set `op` to a whole-Thing operation. [↗](https://www.w3.org/TR/wot-thing-description11/#td-op-for-thing)</details> |
| `links` | Array of Link | Optional | Links to related resources such as manuals, controllers or other Things. |
| `version` | VersionInfo | Optional | Version of this TD, e.g. `{"instance": "1.2.0"}`. |
| `created` | dateTime | Optional | When the TD was created (RFC 3339).<details><summary>⚠️ Watch out</summary>Use UTC with `Z` (`2026-11-09T10:00:00Z`), not an offset. [↗](https://www.w3.org/TR/wot-thing-description11/#td-datetime-type) [↗](https://www.w3.org/TR/wot-thing-description11/#td-datetime-recommended-type)</details> |
| `modified` | dateTime | Optional | When the TD was last modified (RFC 3339).<details><summary>⚠️ Watch out</summary>Use UTC with `Z`, not an offset. [↗](https://www.w3.org/TR/wot-thing-description11/#td-datetime-type) [↗](https://www.w3.org/TR/wot-thing-description11/#td-datetime-recommended-type)</details> |
| `support` | anyURI | Optional | Contact for the TD maintainer, as a `mailto:`, `tel:` or `https:` URI. |
| `profile` | anyURI or Array of anyURI | Optional | Profile(s) the TD conforms to. |
| `schemaDefinitions` | Map of DataSchema | Optional | Named, reusable data schemas, referenced by `additionalResponses[].schema`. |
| `uriVariables` | Map of DataSchema | Optional | URI template variables shared by all forms. Variables can't be objects or arrays, and an affordance-level variable with the same name wins. |

  </TabItem>
  <TabItem value="required" label="Required only (4)">

| Term | Type | Required | Description |
|---|---|---|---|
| `@context` | anyURI or Array | Required | Marks the document as a TD 1.1. Extra vocabularies (e.g. `schema.org`) are added as prefix objects in the array.<details><summary>⚠️ Watch out</summary>Must include the TD 1.1 URI. If you also include the TD 1.0 URI, it comes first. Add `{"@language": "en"}` to set the default language. [↗](https://www.w3.org/TR/wot-thing-description11/#td-context-ns-thing-mandatory) [↗](https://www.w3.org/TR/wot-thing-description11/#td-context-ns-td10-namespace) [↗](https://www.w3.org/TR/wot-thing-description11/#td-context-default-language)</details> |
| `title` | string | Required | Human-readable name of the Thing. |
| `securityDefinitions` | Map of SecurityScheme | Required | Named security configurations that `security` and forms can refer to.<details><summary>⚠️ Watch out</summary>A definition has no effect until its name is used in a `security` member. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-securityDefinitions--Thing)</details> |
| `security` | string or Array of string | Required | Names of the `securityDefinitions` that apply to every form by default. All listed names must be satisfied.<details><summary>⚠️ Watch out</summary>Required even for an open Thing (use `nosec`). Every name must exist in `securityDefinitions`. To combine schemes, use `combo` instead of an array. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-mandatory) [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-security--Thing) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-combo-deprecation)</details> |

  </TabItem>
</Tabs>

#### Version information {#versioninfo}

See [VersionInfo](https://www.w3.org/TR/wot-thing-description11/#versioninfo) in the specification.

<Tabs>
  <TabItem value="all" label="All terms (2)" default>

| Term | Type | Required | Description |
|---|---|---|---|
| `instance` | string | Required | Version of this TD instance, ideally semantic versioning. |
| `model` | string | Optional | Version of the underlying device model. |

  </TabItem>
  <TabItem value="required" label="Required only (1)">

| Term | Type | Required | Description |
|---|---|---|---|
| `instance` | string | Required | Version of this TD instance, ideally semantic versioning. |

  </TabItem>
</Tabs>

### Interaction Affordances {#affordances}

Every property, action and event can use these terms. See [InteractionAffordance](https://www.w3.org/TR/wot-thing-description11/#interactionaffordance) in the specification.

<Tabs>
  <TabItem value="all" label="All terms (7)" default>

| Term | Type | Required | Description |
|---|---|---|---|
| `forms` | Array of Form | Required | How to reach this affordance over the network (at least one).<details><summary>⚠️ Watch out</summary>Can't be empty, and every form needs an `href`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-forms--InteractionAffordance)</details> |
| `title` | string | Optional | Human-readable name.<details><summary>⚠️ Watch out</summary>Display text only. Machines use the affordance name (the key), so keep that short, stable and without spaces. *(recommendation)*</details> |
| `description` | string | Optional | Human-readable description. |
| `titles` | Map of MultiLanguage | Optional | Translations of `title`. |
| `descriptions` | Map of MultiLanguage | Optional | Translations of `description`. |
| `@type` | string or Array of string | Optional | Semantic annotation of the affordance. |
| `uriVariables` | Map of DataSchema | Optional | Describes `{variables}` used in URI-template `href`s.<details><summary>⚠️ Watch out</summary>Variables can't be objects or arrays. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-uriVariables--InteractionAffordance)</details> |

  </TabItem>
  <TabItem value="required" label="Required only (1)">

| Term | Type | Required | Description |
|---|---|---|---|
| `forms` | Array of Form | Required | How to reach this affordance over the network (at least one).<details><summary>⚠️ Watch out</summary>Can't be empty, and every form needs an `href`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-forms--InteractionAffordance)</details> |

  </TabItem>
</Tabs>

Each type of affordance adds its own terms on top of these. See [Interaction Affordances](./interaction-affordances.md) for the background.

<Tabs groupId="affordance">
  <TabItem value="property" label="Property" default>

A property is also a DataSchema, so `type`, `minimum`, `readOnly`, `unit` and the other data schema terms go directly on it. See [PropertyAffordance](https://www.w3.org/TR/wot-thing-description11/#propertyaffordance) in the specification.

| Term | Type | Required | Default | Description |
|---|---|---|---|---|
| `observable` | boolean | Optional | `false` | A hint that the Thing supports observing value changes (`observeproperty`).<details><summary>⚠️ Watch out</summary>Only a hint. You still need a form with `observeproperty`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-observable--PropertyAffordance)</details> |
| `readOnly` | boolean | Optional | `false` | Property can only be read. Changes the default `op` to `readproperty` only.<details><summary>⚠️ Watch out</summary>Without `op`, a property form allows reading *and* writing, unless `readOnly` is `true`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-default-op-properties)</details> |
| `writeOnly` | boolean | Optional | `false` | Property can only be written. Changes the default `op` to `writeproperty` only. |
| `… DataSchema terms` | see DataSchema | Optional | — | `type`, `unit`, `minimum`, `enum`, … describe the property's value. |

  </TabItem>
  <TabItem value="action" label="Action">

See [ActionAffordance](https://www.w3.org/TR/wot-thing-description11/#actionaffordance) in the specification.

| Term | Type | Required | Default | Description |
|---|---|---|---|---|
| `input` | DataSchema | Optional | — | Schema of the data sent when invoking the action. |
| `output` | DataSchema | Optional | — | Schema of the data returned by the action. |
| `safe` | boolean | Optional | `false` | The action does not change any state (like a read). |
| `idempotent` | boolean | Optional | `false` | Invoking it repeatedly with the same input has the same effect as invoking it once. |
| `synchronous` | boolean | Optional | — | Whether the result is returned in the response (`true`) or the action runs asynchronously (`false`). If omitted, it is unknown. |

  </TabItem>
  <TabItem value="event" label="Event">

See [EventAffordance](https://www.w3.org/TR/wot-thing-description11/#eventaffordance) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `data` | DataSchema | Optional | Schema of the event payload pushed to the consumer. |
| `subscription` | DataSchema | Optional | Data the consumer must send when subscribing (e.g. a callback URL). |
| `dataResponse` | DataSchema | Optional | Data the consumer sends back after receiving an event. |
| `cancellation` | DataSchema | Optional | Data the consumer must send when unsubscribing. |

  </TabItem>
</Tabs>

### Form {#form}

A form binds an operation to a concrete endpoint and protocol. See [Form](https://www.w3.org/TR/wot-thing-description11/#form) in the specification.

<Tabs>
  <TabItem value="all" label="All terms (9)" default>

| Term | Type | Required | Default | Description |
|---|---|---|---|---|
| `href` | anyURI | Required | — | Target URI. It may be relative to `base` and may be a URI template (`{var}`).<details><summary>⚠️ Watch out</summary>Must match the Thing's real endpoint and follow the protocol binding of its URI scheme. The form must describe the request accurately, including headers. [↗](https://www.w3.org/TR/wot-thing-description11/#server-uri-template) [↗](https://www.w3.org/TR/wot-thing-description11/#bindings-requirements-scheme) [↗](https://www.w3.org/TR/wot-thing-description11/#bindings-server-accept)</details> |
| `op` | string or Array of string | Optional | `property: readproperty + writeproperty (only readproperty if readOnly, only writeproperty if writeOnly) · action: invokeaction · event: subscribeevent + unsubscribeevent · Thing level: none, op is mandatory` | Operation(s) this form performs, e.g. `readproperty`, `observeproperty`, `invokeaction`.<details><summary>⚠️ Watch out</summary>Only values allowed where the form sits (see the table below). [↗](https://www.w3.org/TR/wot-thing-description11/#td-op-for-property) [↗](https://www.w3.org/TR/wot-thing-description11/#td-op-for-action) [↗](https://www.w3.org/TR/wot-thing-description11/#td-op-for-event)</details> |
| `contentType` | string | Optional | `application/json` | Media type of the request/response payload. |
| `contentCoding` | string | Optional | — | Content coding such as `gzip`. |
| `subprotocol` | string | Optional | — | Protocol extension, e.g. `longpoll`, `websub` or `sse`. |
| `security` | string or Array of string | Optional | — | Overrides the Thing-level `security` for this form.<details><summary>⚠️ Watch out</summary>Replaces the Thing-level `security` for this form. It doesn't add to it. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-overrides)</details> |
| `scopes` | string or Array of string | Optional | — | OAuth 2.0 scopes needed for this form. |
| `response` | ExpectedResponse | Optional | — | The response, if its content type differs from the form's `contentType`, e.g. `{"contentType": "text/plain"}`.<details><summary>⚠️ Watch out</summary>Required if the response content type differs from the form's. [↗](https://www.w3.org/TR/wot-thing-description11/#td-expectedResponse-contentType)</details> |
| `additionalResponses` | Array of AdditionalExpectedResponse | Optional | — | Other possible responses, such as errors with their own schema.<details><summary>⚠️ Watch out</summary>Required for responses with a different content type or schema. [↗](https://www.w3.org/TR/wot-thing-description11/#td-additionalExpectedResponse-contentType) [↗](https://www.w3.org/TR/wot-thing-description11/#td-additionalExpectedResponse-schema)</details> |

  </TabItem>
  <TabItem value="required" label="Required only (1)">

| Term | Type | Required | Description |
|---|---|---|---|
| `href` | anyURI | Required | Target URI. It may be relative to `base` and may be a URI template (`{var}`).<details><summary>⚠️ Watch out</summary>Must match the Thing's real endpoint and follow the protocol binding of its URI scheme. The form must describe the request accurately, including headers. [↗](https://www.w3.org/TR/wot-thing-description11/#server-uri-template) [↗](https://www.w3.org/TR/wot-thing-description11/#bindings-requirements-scheme) [↗](https://www.w3.org/TR/wot-thing-description11/#bindings-server-accept)</details> |

  </TabItem>
</Tabs>

#### Operation types

Which `op` values you can use depends on where the form is:

| Form is in… | Allowed `op` values |
|---|---|
| a property | `readproperty`, `writeproperty`, `observeproperty`, `unobserveproperty` |
| an action | `invokeaction`, `queryaction`, `cancelaction` |
| an event | `subscribeevent`, `unsubscribeevent` |
| the Thing (top-level `forms`) | `readallproperties`, `writeallproperties`, `readmultipleproperties`, `writemultipleproperties`, `observeallproperties`, `unobserveallproperties`, `queryallactions`, `subscribeallevents`, `unsubscribeallevents` |

#### Responses

<Tabs groupId="response">
  <TabItem value="response" label="response" default>

See [ExpectedResponse](https://www.w3.org/TR/wot-thing-description11/#expectedresponse) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `contentType` | string | Required | Media type of the response. |

  </TabItem>
  <TabItem value="additional" label="additionalResponses">

See [AdditionalExpectedResponse](https://www.w3.org/TR/wot-thing-description11/#additionalexpectedresponse) in the specification.

| Term | Type | Required | Default | Description |
|---|---|---|---|---|
| `success` | boolean | Optional | `false` | Whether this response means success. |
| `contentType` | string | Optional | `the form's contentType` | Media type of this response. |
| `schema` | string | Optional | — | Name of an entry in the Thing's `schemaDefinitions`. |

  </TabItem>
</Tabs>

### Data Schema {#dataschema}

Used for property values, action `input`/`output`, event `data` and `uriVariables`. Closely follows JSON Schema. See [DataSchema](https://www.w3.org/TR/wot-thing-description11/#dataschema) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `type` | string | Optional | One of `object`, `array`, `string`, `number`, `integer`, `boolean`, `null`.<details><summary>⚠️ Watch out</summary>The schema must describe the data accurately. Add constraints such as `unit`, `minimum` or `enum` where they apply. [↗](https://www.w3.org/TR/wot-thing-description11/#server-data-schema)</details> |
| `title` | string | Optional | Human-readable name. |
| `description` | string | Optional | Human-readable description. |
| `unit` | string | Optional | Unit of the value, e.g. `celsius` or `om:litre`.<details><summary>⚠️ Watch out</summary>Preferably a semantic unit, e.g. `om:litre` with its prefix in `@context`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-unit--DataSchema)</details> |
| `readOnly` | boolean | Optional | Value can only be read. Defaults to `false` only on properties. |
| `writeOnly` | boolean | Optional | Value can only be written. Defaults to `false` only on properties. |
| `enum` | Array of any | Optional | Restricts the value to a fixed list. |
| `const` | any | Optional | Value is always exactly this. |
| `default` | any | Optional | Value used when none is given.<details><summary>⚠️ Watch out</summary>Should itself be valid against the schema. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-default--DataSchema)</details> |
| `oneOf` | Array of DataSchema | Optional | The value must match exactly one of these schemas. |
| `format` | string | Optional | Format hint, e.g. `date-time`, `email`, `uri`. |
| `@type` | string or Array of string | Optional | Semantic annotation of the value. |
| `titles` | Map of MultiLanguage | Optional | Translations of `title`. |
| `descriptions` | Map of MultiLanguage | Optional | Translations of `description`. |

#### Type-specific terms

Depending on `type`, you can add further constraints. These work like in JSON Schema, see the [JSON Schema](../../preliminary/json-schema/intro.md) tutorial.

<Tabs groupId="schema-type">
  <TabItem value="number" label="number / integer" default>

See [NumberSchema](https://www.w3.org/TR/wot-thing-description11/#numberschema) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `minimum` | double (integer for `integer`) | Optional | Smallest allowed value (inclusive). |
| `maximum` | double (integer for `integer`) | Optional | Largest allowed value (inclusive). |
| `exclusiveMinimum` | double (integer for `integer`) | Optional | Value must be greater than this. |
| `exclusiveMaximum` | double (integer for `integer`) | Optional | Value must be less than this. |
| `multipleOf` | double (integer for `integer`) | Optional | Value must be a multiple of this (e.g. `0.5`). Must be greater than 0. |

  </TabItem>
  <TabItem value="string" label="string">

See [StringSchema](https://www.w3.org/TR/wot-thing-description11/#stringschema) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `minLength` | unsignedInt | Optional | Minimum string length. |
| `maxLength` | unsignedInt | Optional | Maximum string length. |
| `pattern` | string | Optional | Regular expression the string must match. |
| `contentEncoding` | string | Optional | Encoding of binary data inside the string, e.g. `base64`. |
| `contentMediaType` | string | Optional | Media type of the encoded content, e.g. `image/png`. |

  </TabItem>
  <TabItem value="array" label="array">

See [ArraySchema](https://www.w3.org/TR/wot-thing-description11/#arrayschema) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `items` | DataSchema or Array of DataSchema | Optional | Schema of the array elements. |
| `minItems` | unsignedInt | Optional | Minimum number of elements. |
| `maxItems` | unsignedInt | Optional | Maximum number of elements. |

  </TabItem>
  <TabItem value="object" label="object">

See [ObjectSchema](https://www.w3.org/TR/wot-thing-description11/#objectschema) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `properties` | Map of DataSchema | Optional | Schemas of the object's members. |
| `required` | Array of string | Optional | Names of members that must be present.<details><summary>⚠️ Watch out</summary>An array of member names on the object, not a boolean on each member. [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-required--ObjectSchema)</details> |

  </TabItem>
</Tabs>

### Security {#security}

Every entry in `securityDefinitions` has a `scheme`. The other terms depend on which scheme it is. See [SecurityScheme](https://www.w3.org/TR/wot-thing-description11/#securityscheme) in the specification.

<Tabs>
  <TabItem value="all" label="All terms (5)" default>

| Term | Type | Required | Description |
|---|---|---|---|
| `scheme` | string | Required | `nosec`, `auto`, `combo`, `basic`, `digest`, `apikey`, `bearer`, `psk` or `oauth2`, or a scheme from a TD context extension.<details><summary>⚠️ Watch out</summary>Never put passwords, keys or tokens in a TD. Declare exactly the schemes the Thing requires, and use `nosec` only where no authentication is really needed. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-no-secrets) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-binding) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-no-extras)</details> |
| `description` | string | Optional | Human-readable description. |
| `descriptions` | Map of MultiLanguage | Optional | Translations of `description`. |
| `proxy` | anyURI | Optional | URI of a proxy server this scheme applies to. |
| `@type` | string or Array of string | Optional | Semantic annotation. |

  </TabItem>
  <TabItem value="required" label="Required only (1)">

| Term | Type | Required | Description |
|---|---|---|---|
| `scheme` | string | Required | `nosec`, `auto`, `combo`, `basic`, `digest`, `apikey`, `bearer`, `psk` or `oauth2`, or a scheme from a TD context extension.<details><summary>⚠️ Watch out</summary>Never put passwords, keys or tokens in a TD. Declare exactly the schemes the Thing requires, and use `nosec` only where no authentication is really needed. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-no-secrets) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-binding) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-no-extras)</details> |

  </TabItem>
</Tabs>

#### Scheme-specific terms

The `nosec` and `auto` schemes have no extra terms. With `auto`, the protocol negotiates the security details when the Consumer connects, so the TD doesn't reveal them. That can help if vulnerability scanning is a concern ([sec-vuln-auto](https://www.w3.org/TR/wot-thing-description11/#sec-vuln-auto)). The other schemes do, and `in` and `name` work the same way in all of them:

 - With `"in": "auto"`, leave out `name`. [↗](https://www.w3.org/TR/wot-thing-description11/#sec-security-vocab-auto-in-no-name)
 - With `"in": "body"`, `name` is a JSON pointer to a required string field in the payload, e.g. `/auth/token`. The field doesn't have to exist in the input schema yet, and `-` in the pointer appends to an array. [↗](https://www.w3.org/TR/wot-thing-description11/#sec-body-name-json-pointer) [↗](https://www.w3.org/TR/wot-thing-description11/#sec-body-name-json-pointer-type) [↗](https://www.w3.org/TR/wot-thing-description11/#sec-body-name-json-pointer-creatable) [↗](https://www.w3.org/TR/wot-thing-description11/#sec-body-name-json-pointer-array)

<Tabs groupId="security-scheme">
  <TabItem value="basic" label="basic" default>

See [BasicSecurityScheme](https://www.w3.org/TR/wot-thing-description11/#basicsecurityscheme) in the specification.

| Term | Type | Required | Default | Description |
|---|---|---|---|---|
| `in` | string | Optional | `header` | Where credentials go: `header`, `query`, `body`, `cookie` or `auto`. |
| `name` | string | Optional | — | Name of the header/query parameter/cookie. |

  </TabItem>
  <TabItem value="digest" label="digest">

See [DigestSecurityScheme](https://www.w3.org/TR/wot-thing-description11/#digestsecurityscheme) in the specification.

| Term | Type | Required | Default | Description |
|---|---|---|---|---|
| `qop` | string | Optional | `auth` | Quality of protection: `auth` or `auth-int`. |
| `in` | string | Optional | `header` | Where credentials go. |
| `name` | string | Optional | — | Name of the header/query parameter/cookie. |

  </TabItem>
  <TabItem value="apikey" label="apikey">

See [APIKeySecurityScheme](https://www.w3.org/TR/wot-thing-description11/#apikeysecurityscheme) in the specification.

| Term | Type | Required | Default | Description |
|---|---|---|---|---|
| `in` | string | Optional | `query` | Where the key goes: `header`, `query`, `body`, `cookie`, `uri` or `auto`.<details><summary>⚠️ Watch out</summary>Use `uri` only if `query` isn't possible. Then every `href` must be a URI template with that variable, and its name must not clash with other `uriVariables`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-in-query-over-uri) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-in-uri-variable) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-uri-variables-distinct)</details> |
| `name` | string | Optional | — | Name of the parameter, e.g. `X-API-Key`. |

  </TabItem>
  <TabItem value="bearer" label="bearer">

See [BearerSecurityScheme](https://www.w3.org/TR/wot-thing-description11/#bearersecurityscheme) in the specification.

| Term | Type | Required | Default | Description |
|---|---|---|---|---|
| `authorization` | anyURI | Optional | — | Where to obtain the token. |
| `format` | string | Optional | `jwt` | Token format, e.g. `jwt`, `cwt`, `jwe`, `jws`. Other formats can come from a vocabulary extension. |
| `alg` | string | Optional | `ES256` | Signing algorithm, e.g. `ES256`, `ES512-256`. Other algorithms can come from a vocabulary extension. |
| `in` | string | Optional | `header` | Where the token goes. |
| `name` | string | Optional | — | Name of the header/query parameter/cookie. |

  </TabItem>
  <TabItem value="psk" label="psk">

See [PSKSecurityScheme](https://www.w3.org/TR/wot-thing-description11/#psksecurityscheme) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `identity` | string | Optional | Identifier of the pre-shared key. |

  </TabItem>
  <TabItem value="oauth2" label="oauth2">

See [OAuth2SecurityScheme](https://www.w3.org/TR/wot-thing-description11/#oauth2securityscheme) in the specification.

<Tabs>
  <TabItem value="all" label="All terms (5)" default>

| Term | Type | Required | Description |
|---|---|---|---|
| `flow` | string | Required | Authorization flow: `code` or `client`.<details><summary>⚠️ Watch out</summary>`code` needs `authorization` and `token`. `client` needs `token` and must not have `authorization`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-oauth2-code-flow) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-oauth2-client-flow) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-oauth2-client-flow-no-auth)</details> |
| `authorization` | anyURI | Conditional: Required for the `code` flow. Must be left out for the `client` flow. | Authorization server endpoint. |
| `token` | anyURI | Conditional: Required for both the `code` and `client` flows. | Token endpoint. |
| `refresh` | anyURI | Optional | Endpoint for refreshing tokens. |
| `scopes` | string or Array of string | Optional | All scopes this scheme can grant. Forms list the ones they need. |

  </TabItem>
  <TabItem value="required" label="Required only (3)">

| Term | Type | Required | Description |
|---|---|---|---|
| `flow` | string | Required | Authorization flow: `code` or `client`.<details><summary>⚠️ Watch out</summary>`code` needs `authorization` and `token`. `client` needs `token` and must not have `authorization`. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-oauth2-code-flow) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-oauth2-client-flow) [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-oauth2-client-flow-no-auth)</details> |
| `authorization` | anyURI | Conditional: Required for the `code` flow. Must be left out for the `client` flow. | Authorization server endpoint. |
| `token` | anyURI | Conditional: Required for both the `code` and `client` flows. | Token endpoint. |

  </TabItem>
</Tabs>

  </TabItem>
  <TabItem value="combo" label="combo">

See [ComboSecurityScheme](https://www.w3.org/TR/wot-thing-description11/#combosecurityscheme) in the specification.

| Term | Type | Required | Description |
|---|---|---|---|
| `oneOf` | Array of string | Conditional: Exactly one of oneOf / allOf. | The consumer may use any one of these named schemes (two or more).<details><summary>⚠️ Watch out</summary>Use exactly one of `oneOf` or `allOf`, with at least two scheme names. [↗](https://www.w3.org/TR/wot-thing-description11/#td-security-combo-exclusive-oneof-or-allof) [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-oneOf--ComboSecurityScheme) [↗](https://www.w3.org/TR/wot-thing-description11/#td-vocab-allOf--ComboSecurityScheme)</details> |
| `allOf` | Array of string | Conditional: Exactly one of oneOf / allOf. | The consumer must satisfy all of these named schemes (two or more). |

  </TabItem>
</Tabs>

### Link {#link}

See [Link](https://www.w3.org/TR/wot-thing-description11/#link) in the specification.

<Tabs>
  <TabItem value="all" label="All terms (6)" default>

| Term | Type | Required | Description |
|---|---|---|---|
| `href` | anyURI | Required | Target of the link. |
| `rel` | string | Optional | Relation type, e.g. `controlledBy`, `service-doc`, `icon`. |
| `type` | string | Optional | Media type of the target, e.g. `application/td+json`. |
| `anchor` | anyURI | Optional | Overrides the link context (by default, the Thing itself). |
| `sizes` | string | Optional | Icon sizes, e.g. `16x16`. Only for `rel` `icon`. |
| `hreflang` | string or Array of string | Optional | Language of the target resource. |

  </TabItem>
  <TabItem value="required" label="Required only (1)">

| Term | Type | Required | Description |
|---|---|---|---|
| `href` | anyURI | Required | Target of the link. |

  </TabItem>
</Tabs>

### Default Values {#defaults}

These are the values a Consumer assumes when a term is missing. It is still good practice to write them out, so anyone reading your TD can see how the Thing behaves.

| Class | Term | Default when omitted |
|---|---|---|
| PropertyAffordance | `observable` | `false` |
| PropertyAffordance | `readOnly` | `false` |
| PropertyAffordance | `writeOnly` | `false` |
| ActionAffordance | `safe` | `false` |
| ActionAffordance | `idempotent` | `false` |
| Form | `op` | `property: readproperty + writeproperty (only readproperty if readOnly, only writeproperty if writeOnly) · action: invokeaction · event: subscribeevent + unsubscribeevent · Thing level: none, op is mandatory` |
| Form | `contentType` | `application/json` |
| AdditionalExpectedResponse | `success` | `false` |
| AdditionalExpectedResponse | `contentType` | `the form's contentType` |
| BasicSecurityScheme | `in` | `header` |
| DigestSecurityScheme | `qop` | `auth` |
| DigestSecurityScheme | `in` | `header` |
| APIKeySecurityScheme | `in` | `query` |
| BearerSecurityScheme | `format` | `jwt` |
| BearerSecurityScheme | `alg` | `ES256` |
| BearerSecurityScheme | `in` | `header` |

Protocol-specific details go in prefixed terms on the form, such as `htv:methodName` for the HTTP method. [↗](https://www.w3.org/TR/wot-thing-description11/#td-form-protocolbindings) HTTP forms without a method have a default, depending on the operation: [↗](https://www.w3.org/TR/wot-thing-description11/#td-default-http-method)

| Operation | Default HTTP method |
|---|---|
| `readproperty`, `readallproperties`, `readmultipleproperties` | `GET` |
| `writeproperty`, `writeallproperties`, `writemultipleproperties` | `PUT` |
| `invokeaction` | `POST` |

## Recipes

### Make a property observable

Set `observable` to `true` and add a form with the `observeproperty` operation. Over HTTP, this usually uses a subprotocol such as `sse` or `longpoll`.

```json
"coffeeBeansLeft": {
  "type": "number",
  "readOnly": true,
  "observable": true,
  "forms": [
    { "href": "properties/coffeeBeansLeft", "op": "readproperty" },
    { "href": "properties/coffeeBeansLeft/observe", "op": "observeproperty", "subprotocol": "sse" }
  ]
}
```

### Require authentication, except for one form

The Thing-level `security` applies to every form. A `security` inside a form replaces it for that form only.

```json
"securityDefinitions": {
  "basic_sc": { "scheme": "basic" },
  "nosec_sc": { "scheme": "nosec" }
},
"security": "basic_sc",
"properties": {
  "coffeeBeansLeft": {
    "type": "number",
    "forms": [
      { "href": "properties/coffeeBeansLeft", "security": "nosec_sc" }
    ]
  }
}
```

### Describe an action's input and output

`input` and `output` are data schemas. Use `required` to mark the input fields a Consumer has to send.

```json
"brewCoffee": {
  "input": {
    "type": "object",
    "properties": {
      "drinkType": { "type": "string", "enum": ["espresso", "latte", "americano"] },
      "size": { "type": "string", "enum": ["small", "medium", "large"], "default": "medium" }
    },
    "required": ["drinkType"]
  },
  "output": {
    "type": "object",
    "properties": { "orderId": { "type": "string" } }
  },
  "forms": [{ "href": "actions/brewCoffee" }]
}
```

### Read all properties in one request

Add a top-level `forms` entry with a Thing-level operation. Here, `op` is mandatory.

```json
{
  "title": "Smart Coffee Machine",
  ...
  "forms": [
    { "href": "properties", "op": "readallproperties" }
  ]
}
```

## Summary

Every TD needs `@context`, `title`, `securityDefinitions` and `security`, every affordance needs `forms`, and every form needs an `href`. Everything else is optional. Start from the minimal TD, add what your Thing needs from the cheatsheet, and validate the result in the [Playground](https://playground.thingweb.io/). In the [next tutorial](./writing-a-good-td.md), we look at how to make a TD easy for others to read and use.
