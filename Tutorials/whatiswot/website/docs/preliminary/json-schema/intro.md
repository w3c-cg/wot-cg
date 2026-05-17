---
sidebar_label: Introduction
---

import useBaseUrl from '@docusaurus/useBaseUrl';

# Introduction to JSON Schema

<iframe width="100%" height="400" src="https://www.youtube.com/embed/BPqDBu6fT-0?si=L-sz7baJzoAqjo3b" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

If YouTube does not work, <a href = "https://github.com/w3c/wot-cg/blob/main/Tutorials/whatiswot/5-JSON_Schema/5-JSON-Schema.mp4">click here to watch from our GitHub repository.</a>  

<br />
<br />

We will now briefly explain Schema Languages and then move on to JSON Schema. JSON Schema is particularly important in the Web of Things context as it describes and validates JSON data.

## Schema

Many payload formats offer a way to describe what a payload instance should look like. Generally, these are called Schema Languages.

For example:

- JSON Schema
- XML Schema
- PDF Schema

## JSON Schema

JSON Schema serves as a JSON document that describes and validates the structure of a JSON payload instance.

Its main purpose is to provide guidance to senders, such as clients, on the expected format of their requests, while enabling receivers to automatically validate incoming payloads. Despite being JSON itself, JSON Schema serves as metadata.

<figure id="fig-json-schema">
  <img src={useBaseUrl('/img/tutorial/JSON-Schema/schema.png')} alt="JSON Schema overview"/>
  <figcaption><strong>Figure 1.</strong> JSON Schema overview.</figcaption>
</figure>

For instance, a basic JSON Schema like "type": "array" specifies that it accepts an array type in other JSON documents. Similar specifications can be defined for other data types in JSON, such as:

- string
- number
- boolean
- null

During the validation process on the receiver's end, this schema ensures that the incoming data conforms to the specified structure. [Figure 2](#fig-json-schema-validation) serves as an example of how such validation can be implemented in C#:

<figure id="fig-json-schema-validation">
  <img src={useBaseUrl('/img/5-JSON-Schema/js-schema.png')} alt="JSON Schema overview"/>
  <figcaption><strong>Figure 2.</strong> JSON Schema validation using C#.</figcaption>
</figure>

It can look different in other programming languages.
For instance in Python:

```py
validate(instance={"name" : "Eggs", "price" : 34.99}, schema=schema)
```

Java:

```java
Set<ValidationMessage> errors = schema.validate(node);
```

C++:

```c
jsonschema::json_validator<json> validator(sch);
// Will call reporter for each schema violation
validator.validate(data, reporter);
```

Of course, way more advanced validations can be possible with JSON Schema such as:

- Length of a String
- Regular expressions
- URIs
- Email addresses
- IP addresses
- Max/min for numbers

In Arrays:

- How many items
- Allowed types

In Objects:

- Required properties
- Amount of properties
