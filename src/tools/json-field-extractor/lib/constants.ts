export const DEFAULT_SAMPLE_JSON = `{
  "order": {
    "id": "ORD-2025-0192",
    "customer": {
      "name": "Ava Chen",
      "email": "ava@zenith.dev"
    },
    "items": [
      { "sku": "S-1001", "title": "Aurora Lamp", "price": 129 },
      { "sku": "S-1002", "title": "Nimbus Stand", "price": 89 }
    ]
  }
}`;

export const DEFAULT_SAMPLE_PATHS = `order.id
order.customer.name
order.items[*].sku`;

export const DEFAULT_SAMPLE_SCRIPT = `return items
  .flatMap((item) =>
    item.values.map((value) => item.path + ": " + helpers.toText(value))
  )
  .join("\\n");`;

export const DETECT_PATH_LIMIT = 1500;
export const DETECT_NODE_LIMIT = 20000;

export const SCRIPT_LIST_STORAGE_KEY = "zenith.json-field-extractor.scripts";
export const SCRIPT_ACTIVE_STORAGE_KEY = "zenith.json-field-extractor.active-script";
export const LEGACY_SCRIPT_STORAGE_KEY = "zenith.json-field-extractor.script";
