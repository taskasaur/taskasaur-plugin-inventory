import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  inventorySchema,
  boundedDownload,
  validateDownloadUrl,
} from "@taskasaur/platform/plugin-sdk/inventory";
import { verifyArtifact } from "@taskasaur/platform/plugin-sdk/artifact";
import { isRequiredCore } from "@taskasaur/platform/core/catalog";
const inventory = inventorySchema.parse(
    JSON.parse(await readFile("plugins.json", "utf8")),
  ),
  ids = new Set(inventory.plugins.map((p) => p.id));
for (const entry of inventory.plugins) {
  assert(!isRequiredCore(entry.id), "Core providers cannot be replaced");
  validateDownloadUrl(entry.downloadUrl);
  for (const id of entry.dependencies)
    assert(ids.has(id) || isRequiredCore(id), `Missing dependency ${id}`);
  const visit = (id, chain = new Set()) => {
    assert(!chain.has(id), "Dependency cycle");
    for (const child of inventory.plugins.find((p) => p.id === id)
      ?.dependencies ?? [])
      visit(child, new Set([...chain, id]));
  };
  visit(entry.id);
  if (process.argv.includes("--download"))
    await verifyArtifact(
      await boundedDownload(entry.downloadUrl, 50 * 1024 * 1024),
      inventory.publishers,
      entry,
    );
  console.log(
    `${entry.id}@${entry.version}: valid${process.argv.includes("--download") ? " and verified" : ""}`,
  );
}
