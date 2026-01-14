# DefaultApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**damagesGet**](DefaultApi.md#damagesget) | **GET** /damages | Get all Damages |
| [**damagesIdDelete**](DefaultApi.md#damagesiddelete) | **DELETE** /damages/{id} | Delete damage |
| [**damagesIdPut**](DefaultApi.md#damagesidput) | **PUT** /damages/{id} | Update damage |
| [**damagesPost**](DefaultApi.md#damagespost) | **POST** /damages | Register new damage |
| [**itemsIdDelete**](DefaultApi.md#itemsiddelete) | **DELETE** /items/{id} | Delete individual item |
| [**itemsIdGet**](DefaultApi.md#itemsidget) | **GET** /items/{id} | Get individual item by id |
| [**itemsIdPut**](DefaultApi.md#itemsidput) | **PUT** /items/{id} | Update individual item |
| [**itemsPost**](DefaultApi.md#itemspost) | **POST** /items | Create a new individual item |
| [**kitsGet**](DefaultApi.md#kitsget) | **GET** /kits | Get all Kits |
| [**kitsIdGet**](DefaultApi.md#kitsidget) | **GET** /kits/{id} | Get Kit by id |
| [**kitsIdPut**](DefaultApi.md#kitsidput) | **PUT** /kits/{id} | Update Kit |
| [**kitsPost**](DefaultApi.md#kitspost) | **POST** /kits | Add new Kit |
| [**locationsGet**](DefaultApi.md#locationsget) | **GET** /locations | Get all Locations |
| [**locationsIdDelete**](DefaultApi.md#locationsiddelete) | **DELETE** /locations/{id} | Delete storage location |
| [**locationsPost**](DefaultApi.md#locationspost) | **POST** /locations | Add new storage location |
| [**materialsBulkIdPut**](DefaultApi.md#materialsbulkidput) | **PUT** /materials/bulk/{id} | Update Bulk Material |
| [**materialsBulkPost**](DefaultApi.md#materialsbulkpost) | **POST** /materials/bulk | Create new Bulk Material |
| [**materialsGet**](DefaultApi.md#materialsget) | **GET** /materials | Get all Materials |
| [**materialsIdDelete**](DefaultApi.md#materialsiddelete) | **DELETE** /materials/{id} | Delete Material |
| [**materialsIdGet**](DefaultApi.md#materialsidget) | **GET** /materials/{id} | Get Material by id |
| [**materialsIdItemsGet**](DefaultApi.md#materialsiditemsget) | **GET** /materials/{id}/items | Get Items for Material by id |
| [**materialsIndividualIdPut**](DefaultApi.md#materialsindividualidput) | **PUT** /materials/individual/{id} | Update Individual Material |
| [**materialsIndividualPost**](DefaultApi.md#materialsindividualpost) | **POST** /materials/individual | Create new Individual Material |



## damagesGet

> Array&lt;DamageReport&gt; damagesGet(itemId)

Get all Damages

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DamagesGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the item to get damages for. Get all Damages if not provided. (optional)
    itemId: itemId_example,
  } satisfies DamagesGetRequest;

  try {
    const data = await api.damagesGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **itemId** | `string` | The id of the item to get damages for. Get all Damages if not provided. | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;DamageReport&gt;**](DamageReport.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A list of damages |  -  |
| **400** | If the item_id parameter is malformed. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## damagesIdDelete

> damagesIdDelete(id)

Delete damage

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DamagesIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the damage to delete
    id: id_example,
  } satisfies DamagesIdDeleteRequest;

  try {
    const data = await api.damagesIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the damage to delete | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## damagesIdPut

> DamageReport damagesIdPut(id, newDamageReport)

Update damage

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DamagesIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the damage to update
    id: id_example,
    // NewDamageReport |  (optional)
    newDamageReport: ...,
  } satisfies DamagesIdPutRequest;

  try {
    const data = await api.damagesIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the damage to update | [Defaults to `undefined`] |
| **newDamageReport** | [NewDamageReport](NewDamageReport.md) |  | [Optional] |

### Return type

[**DamageReport**](DamageReport.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | the updated damage report |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## damagesPost

> DamageReport damagesPost(newDamageReport)

Register new damage

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { DamagesPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // NewDamageReport |  (optional)
    newDamageReport: ...,
  } satisfies DamagesPostRequest;

  try {
    const data = await api.damagesPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **newDamageReport** | [NewDamageReport](NewDamageReport.md) |  | [Optional] |

### Return type

[**DamageReport**](DamageReport.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | the newly created damage report |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## itemsIdDelete

> itemsIdDelete(id)

Delete individual item

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ItemsIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the item do delete
    id: id_example,
  } satisfies ItemsIdDeleteRequest;

  try {
    const data = await api.itemsIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the item do delete | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## itemsIdGet

> IndividualItem itemsIdGet(id)

Get individual item by id

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ItemsIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the item to get
    id: id_example,
  } satisfies ItemsIdGetRequest;

  try {
    const data = await api.itemsIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the item to get | [Defaults to `undefined`] |

### Return type

[**IndividualItem**](IndividualItem.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The returned Individual item |  -  |
| **400** | If the id parameter is malformed. |  -  |
| **404** | If no Item was found for the specified ID |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## itemsIdPut

> IndividualItem itemsIdPut(id, newIndividualItem)

Update individual item

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ItemsIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the item to update
    id: id_example,
    // NewIndividualItem |  (optional)
    newIndividualItem: ...,
  } satisfies ItemsIdPutRequest;

  try {
    const data = await api.itemsIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the item to update | [Defaults to `undefined`] |
| **newIndividualItem** | [NewIndividualItem](NewIndividualItem.md) |  | [Optional] |

### Return type

[**IndividualItem**](IndividualItem.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The updated individual item |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## itemsPost

> IndividualItem itemsPost(newIndividualItem)

Create a new individual item

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { ItemsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // NewIndividualItem |  (optional)
    newIndividualItem: ...,
  } satisfies ItemsPostRequest;

  try {
    const data = await api.itemsPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **newIndividualItem** | [NewIndividualItem](NewIndividualItem.md) |  | [Optional] |

### Return type

[**IndividualItem**](IndividualItem.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The newly created individual item |  -  |
| **400** | If the item could not be created |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## kitsGet

> Array&lt;Kit&gt; kitsGet()

Get all Kits

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { KitsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  try {
    const data = await api.kitsGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;Kit&gt;**](Kit.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A list of kits |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## kitsIdGet

> Kit kitsIdGet(id)

Get Kit by id

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { KitsIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the kit to get
    id: id_example,
  } satisfies KitsIdGetRequest;

  try {
    const data = await api.kitsIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the kit to get | [Defaults to `undefined`] |

### Return type

[**Kit**](Kit.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The Kit |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## kitsIdPut

> Kit kitsIdPut(id, newKit)

Update Kit

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { KitsIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the kit to update
    id: id_example,
    // NewKit |  (optional)
    newKit: ...,
  } satisfies KitsIdPutRequest;

  try {
    const data = await api.kitsIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the kit to update | [Defaults to `undefined`] |
| **newKit** | [NewKit](NewKit.md) |  | [Optional] |

### Return type

[**Kit**](Kit.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | the updated kit |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## kitsPost

> Kit kitsPost(newKit)

Add new Kit

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { KitsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // NewKit |  (optional)
    newKit: ...,
  } satisfies KitsPostRequest;

  try {
    const data = await api.kitsPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **newKit** | [NewKit](NewKit.md) |  | [Optional] |

### Return type

[**Kit**](Kit.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | the newly created kit |  -  |
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## locationsGet

> Array&lt;StorageLocation&gt; locationsGet()

Get all Locations

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { LocationsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  try {
    const data = await api.locationsGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;StorageLocation&gt;**](StorageLocation.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A list of damages |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## locationsIdDelete

> locationsIdDelete(id)

Delete storage location

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { LocationsIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the location to delete
    id: id_example,
  } satisfies LocationsIdDeleteRequest;

  try {
    const data = await api.locationsIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the location to delete | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## locationsPost

> StorageLocation locationsPost(newStorageLocation)

Add new storage location

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { LocationsPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // NewStorageLocation |  (optional)
    newStorageLocation: ...,
  } satisfies LocationsPostRequest;

  try {
    const data = await api.locationsPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **newStorageLocation** | [NewStorageLocation](NewStorageLocation.md) |  | [Optional] |

### Return type

[**StorageLocation**](StorageLocation.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | the newly created storage location |  -  |
| **400** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## materialsBulkIdPut

> BulkMaterial materialsBulkIdPut(id, newBulkMaterial)

Update Bulk Material

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { MaterialsBulkIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the material to update
    id: id_example,
    // NewBulkMaterial |  (optional)
    newBulkMaterial: ...,
  } satisfies MaterialsBulkIdPutRequest;

  try {
    const data = await api.materialsBulkIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the material to update | [Defaults to `undefined`] |
| **newBulkMaterial** | [NewBulkMaterial](NewBulkMaterial.md) |  | [Optional] |

### Return type

[**BulkMaterial**](BulkMaterial.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The updated bulk Material |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## materialsBulkPost

> BulkMaterial materialsBulkPost(newBulkMaterial)

Create new Bulk Material

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { MaterialsBulkPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // NewBulkMaterial |  (optional)
    newBulkMaterial: ...,
  } satisfies MaterialsBulkPostRequest;

  try {
    const data = await api.materialsBulkPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **newBulkMaterial** | [NewBulkMaterial](NewBulkMaterial.md) |  | [Optional] |

### Return type

[**BulkMaterial**](BulkMaterial.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The newly created bulk Material |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## materialsGet

> Array&lt;Material&gt; materialsGet(type)

Get all Materials

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { MaterialsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The [MaterialTrackingType] of the materials to get. (optional)
    type: type_example,
  } satisfies MaterialsGetRequest;

  try {
    const data = await api.materialsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **type** | `string` | The [MaterialTrackingType] of the materials to get. | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;Material&gt;**](Material.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A list of Materials |  -  |
| **400** | If the type parameter is malformed. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## materialsIdDelete

> materialsIdDelete(id)

Delete Material

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { MaterialsIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the material to delete
    id: id_example,
  } satisfies MaterialsIdDeleteRequest;

  try {
    const data = await api.materialsIdDelete(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the material to delete | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## materialsIdGet

> Material materialsIdGet(id)

Get Material by id

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { MaterialsIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the material to get
    id: id_example,
  } satisfies MaterialsIdGetRequest;

  try {
    const data = await api.materialsIdGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the material to get | [Defaults to `undefined`] |

### Return type

[**Material**](Material.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The returned Material |  -  |
| **400** | If the id parameter is malformed. |  -  |
| **404** | If no Material was found for the specified ID |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## materialsIdItemsGet

> Array&lt;IndividualItem&gt; materialsIdItemsGet(id)

Get Items for Material by id

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { MaterialsIdItemsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the material to get items for
    id: id_example,
  } satisfies MaterialsIdItemsGetRequest;

  try {
    const data = await api.materialsIdItemsGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the material to get items for | [Defaults to `undefined`] |

### Return type

[**Array&lt;IndividualItem&gt;**](IndividualItem.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A list of Items |  -  |
| **400** | If the id parameter is malformed or missing. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## materialsIndividualIdPut

> IndividualMaterialSummary materialsIndividualIdPut(id, newIndividualMaterial)

Update Individual Material

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { MaterialsIndividualIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // string | The id of the material to update
    id: id_example,
    // NewIndividualMaterial |  (optional)
    newIndividualMaterial: ...,
  } satisfies MaterialsIndividualIdPutRequest;

  try {
    const data = await api.materialsIndividualIdPut(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` | The id of the material to update | [Defaults to `undefined`] |
| **newIndividualMaterial** | [NewIndividualMaterial](NewIndividualMaterial.md) |  | [Optional] |

### Return type

[**IndividualMaterialSummary**](IndividualMaterialSummary.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The updated individual Material |  -  |
| **400** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## materialsIndividualPost

> IndividualMaterialSummary materialsIndividualPost(newIndividualMaterial)

Create new Individual Material

### Example

```ts
import {
  Configuration,
  DefaultApi,
} from '';
import type { MaterialsIndividualPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new DefaultApi();

  const body = {
    // NewIndividualMaterial |  (optional)
    newIndividualMaterial: ...,
  } satisfies MaterialsIndividualPostRequest;

  try {
    const data = await api.materialsIndividualPost(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **newIndividualMaterial** | [NewIndividualMaterial](NewIndividualMaterial.md) |  | [Optional] |

### Return type

[**IndividualMaterialSummary**](IndividualMaterialSummary.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The newly created individual Material |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

