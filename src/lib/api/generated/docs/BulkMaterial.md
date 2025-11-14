
# BulkMaterial


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`trackingType` | [TrackingType](TrackingType.md)
`category` | string
`description` | string
`location` | [MaterialLocation](MaterialLocation.md)
`availableCount` | number
`damagedCount` | number
`purchaseDate` | string
`purchasePrice` | number

## Example

```typescript
import type { BulkMaterial } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "trackingType": null,
  "category": null,
  "description": null,
  "location": null,
  "availableCount": null,
  "damagedCount": null,
  "purchaseDate": null,
  "purchasePrice": null,
} satisfies BulkMaterial

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as BulkMaterial
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


