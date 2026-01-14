
# NewIndividualItem


## Properties

Name | Type
------------ | -------------
`materialId` | string
`identifier` | string
`condition` | [Condition](Condition.md)
`storageLocation` | [MaterialLocation](MaterialLocation.md)
`purchasePrice` | number
`purchaseDate` | string

## Example

```typescript
import type { NewIndividualItem } from ''

// TODO: Update the object below with actual values
const example = {
  "materialId": null,
  "identifier": null,
  "condition": null,
  "storageLocation": null,
  "purchasePrice": null,
  "purchaseDate": null,
} satisfies NewIndividualItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as NewIndividualItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


