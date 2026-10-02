import { writeFile } from "node:fs/promises";
import { zodToJsonSchema } from "zod-to-json-schema";
import { inventorySchema } from "@taskasaur/platform/plugin-sdk/inventory";
await writeFile(
  "plugins.schema.json",
  JSON.stringify(
    zodToJsonSchema(inventorySchema, { name: "TaskasaurPluginInventory" }),
    null,
    2,
  ) + "\n",
);
