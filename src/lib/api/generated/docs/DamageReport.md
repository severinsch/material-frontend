
# DamageReport


## Properties

Name | Type
------------ | -------------
`id` | string
`inventoryItemId` | string
`description` | string
`isResolved` | boolean
`reportedAt` | string

## Example

```typescript
import type { DamageReport } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "inventoryItemId": null,
  "description": null,
  "isResolved": null,
  "reportedAt": null,
} satisfies DamageReport

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as DamageReport
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


