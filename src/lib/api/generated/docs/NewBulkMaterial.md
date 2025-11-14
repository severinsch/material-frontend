
# NewBulkMaterial


## Properties

Name | Type
------------ | -------------
`name` | string
`storageLocationId` | string
`category` | string
`description` | string
`availableCount` | number
`damagedCount` | number
`purchaseDate` | string
`purchasePrice` | number

## Example

```typescript
import type { NewBulkMaterial } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "storageLocationId": null,
  "category": null,
  "description": null,
  "availableCount": null,
  "damagedCount": null,
  "purchaseDate": null,
  "purchasePrice": null,
} satisfies NewBulkMaterial

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as NewBulkMaterial
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


