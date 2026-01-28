
# NewKitSubstitutionGroupsInner


## Properties

Name | Type
------------ | -------------
`name` | string
`isOptional` | boolean
`requiredUnits` | number
`minRequiredUnits` | number
`options` | [Array&lt;KitSubstitutionGroupsInnerOptionsInner&gt;](KitSubstitutionGroupsInnerOptionsInner.md)

## Example

```typescript
import type { NewKitSubstitutionGroupsInner } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "isOptional": null,
  "requiredUnits": null,
  "minRequiredUnits": null,
  "options": null,
} satisfies NewKitSubstitutionGroupsInner

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as NewKitSubstitutionGroupsInner
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


