
# Kit


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`description` | string
`materials` | [Array&lt;KitMaterialsInner&gt;](KitMaterialsInner.md)

## Example

```typescript
import type { Kit } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "description": null,
  "materials": null,
} satisfies Kit

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Kit
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


