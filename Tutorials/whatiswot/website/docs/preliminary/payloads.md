---
sidebar_label: Payloads and Headers
---

import useBaseUrl from '@docusaurus/useBaseUrl';

# Payloads and Headers

<iframe width="100%" height="400" src="https://www.youtube.com/embed/uooaqTpNtNw?si=vCoRygpQYoy3CXBe" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

If YouTube does not work, <a href = "https://github.com/w3c/wot-cg/blob/main/Tutorials/whatiswot/2-Payloads_and_Headers/2-Payloads_and_Headers.mp4">click here to watch from our GitHub repository.</a>  


<br />
<br />

This is an introductory series that presents technologies and standards relevant to the Web of Things.

## Introduction

In the Web of Things, smart devices typically exchange data with each other. Such data is sent via payloads, therefore it is essential to understand what payloads are and the headers that describe them. Thus, in this section, we will cover the topics of headers and the different types of payloads - including JSON, the most used one in the scope of WoT, and its importance.

<figure id="fig-payloads-headers-overview">
  <img src={useBaseUrl('/img/tutorial/Payloads-And-Headers/payloadsandheaders.png')} alt="Relationship between payloads and headers" />
  <figcaption><strong>Figure 1.</strong> Relationship between payloads and headers.</figcaption>
</figure>

## What is a payload?

In computing, the payload is the part of transmitted data that is the actual intended message of the application and has nothing to do with the protocol itself. It is also called the body of the message. It is not mandatory in most protocols.

> A payload should not tell what should be done by itself. We can better explain this concept with an analogy, where we consider the protocol as a truck. We can think of the payload contents as the goods that this truck is transporting. The truck's goods should not contain any information about their destination, the fact that they are transported with a truck or the color of the truck.

## What is a header?

The header is part of a message that can and should be understood by the protocol stack. All the information that the payload should not contain, goes to the header.

> Let's go back to our truck example. As seen in [Figure 2](#fig-truck-example), the header would be the label on the goods - indicating where they are being transported, what they are and etc.

<figure id="fig-truck-example">
  <img src={useBaseUrl('/img/tutorial/Payloads-And-Headers/truck.png')} alt="Truck and parcel header analogy" />
  <figcaption><strong>Figure 2.</strong> Analogy showing headers as labels on transported goods.</figcaption>
</figure>

## Header Example

This is what an HTTP header can look like. A header can contain information like request context, response context, status and it can indicate payload type.

<figure id="fig-http-header-example">
  <img src={useBaseUrl('/img/tutorial/Payloads-And-Headers/httpheader.png')} alt="Example contents of an HTTP header" />
  <figcaption><strong>Figure 3.</strong> Example contents of an HTTP header.</figcaption>
</figure>

## Payload Types

There are different payload types: JSON, XML, CBOR, text and audio to name a few.

So let us show you an example of a **JSON payload**. 

<figure id="fig-json-payload-example">
  <img src={useBaseUrl('/img/tutorial/Payloads-And-Headers/jsonexample.png')} alt="Example of a JSON payload with sensor values" />
  <figcaption><strong>Figure 4.</strong> Example of a JSON payload used by a temperature sensor.</figcaption>
</figure>

For this example we will take a look at a temperature sensor. [Figure 4](#fig-json-payload-example) helps to illustrate the payloads and their relationship to the sensor. The temperature payload is a single number and is being sent from the sensor. The configuration payload is a JSON object consisting of key/value pairs desiredUnit and updateInterval and is sent to the sensor.

Temparature payload:

```
90
```

Configuration payload:

```json
{
  "desiredUnit": "celcius",
  "updateInterval": 30
}
```

## Why is JSON important?

Because JSON is very relevant in the scope of the Web of Things, payloads are preferred mostly in JSON. Additionally, many other API and configuration files use JSON as well.

Here, you can see an example of a TD in JSON format. We will go into the details of how a TD should be structured and understood in a later section of this tutorial.

```json showLineNumbers
{
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  "title": "MyLampThing",
  …
  "security": "basic_sc",
  "properties": {
    "status": {
      "type": "string",
      "forms": [
        {
          "href": "https://mylamp.example.com/status"
        }
      ]
    }
  },
  "actions": {
    "toggle": {
      "forms": [
        {
          "href": "https://mylamp.example.com/toggle"
        }
      ]
    }
  },
  "events": {
    "overheating": {
      "data": {
        "type": "string"
      },
      "forms": [
        {
          "href": "https://mylamp.example.com/oh",
          "subprotocol": "longpoll"
        }
      ]
    }
  }
}
```

## Comparison

Let's take a look at this JSON example including a few Thing Descriptions - a temperature, humidity and brightness sensors. Each sensor entry includes details such as its type or name, the last calibration date if available, the current measurement value along with its unit, and whether the sensor is active or not.

JSON Example:

```json showLineNumbers
[
  {
    "type": "Temperature Sensor",
    "lastCalibration": "2018-11-13",
    "measurement": {
      "value": 25,
      "unit": "Celsius"
    },
    "isActive": true,
    "precision": 0.1
  },
  {
    "type": "Humidity Sensor",
    "lastCalibration": null,
    "measurement": {
      "value": 60,
      "unit": "Percent"
    },
    "isActive": true
  },
  {
    "name": "Brightness Sensor",
    "lastCalibration": "2020-01-19",
    "measurement": {
      "value": 2,
      "unit": "Lux"
    },
    "isActive": false
  }
]
```

This representation is much more light-weight compared to XML, as seen in the example below...

XML Example:

```xml showLineNumbers
<root>
   <element>
      <isActive>true</isActive>
      <lastCalibration>2018-11-13</lastCalibration>
      <measurement>
         <unit>Celsius</unit>
         <value>25</value>
      </measurement>
      <precision>0.1</precision>
      <type>Temperature Sensor</type>
   </element>
   <element>
      <isActive>true</isActive>
      <lastCalibration null="true" />
      <measurement>
         <unit>Percent</unit>
         <value>60</value>
      </measurement>
      <type>Humidity Sensor</type>
   </element>
   <element>
      <isActive>false</isActive>
      <lastCalibration>2020-01-19</lastCalibration>
      <measurement>
         <unit>Lux</unit>
         <value>2</value>
      </measurement>
      <name>Brightness Sensor</name>
   </element>
</root>

```

...and more human-readable compared to CBOR.

CBOR Example:

```
83A564747970657254656D70657261747572652053656E736F726F6C61737443616C6962726174696F6E7819323031382D31312D31335432303A32303A33392B30303A30306B6D6561737572656D656E74A26576616C7565181964756E69746743656C73697573686973416374697665F569707265636973696F6EFB3FB999999999999AA464747970656F48756D69646974792053656E736F726F6C61737443616C6962726174696F6EF66B6D6561737572656D656E74A26576616C7565183C64756E69746750657263656E74686973416374697665F5A4646E616D65714272696768746E6573732053656E736F726F6C61737443616C6962726174696F6E7819323032302D30312D31395432303A32303A33352B30303A30306B6D6561737572656D656E74A26576616C75650264756E6974634C7578686973416374697665F4
```

Last but not least, JSON is well-established and has a schema language called JSON Schema. It can be used to describe and validate JSON data.
