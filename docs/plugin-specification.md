# Taskasaur plugin specification (platform API 1)

Optional features live in independent repositories and are downloaded as signed ZIP packages. The client and server ship the required core providers and the plugin host. A repository URL is informational: installation uses only the inventory's `downloadUrl`, checksum, and trusted publisher key. Any HTTPS static host or object store can serve the inventory and packages.

## Inventory

`plugins.json` is the catalog the server exposes at `GET /api/plugins/inventory` to workspace members. The Plugins screen displays its names, descriptions, versions, publishers, licenses, dependencies, download locations, and capabilities before installation. One entry represents the current release of a plugin.

```json
{
  "schemaVersion": 1,
  "name": "My Taskasaur catalog",
  "publishers": {
    "example": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
  },
  "plugins": [
    {
      "id": "example.notes",
      "name": "Notes",
      "description": "Small offline notes using shared tables.",
      "version": "1.0.0",
      "publisher": "example",
      "license": "GPL-3.0-only",
      "downloadUrl": "https://downloads.example.org/notes/1.0.0/plugin.zip",
      "sha256": "64 lowercase hexadecimal characters",
      "repositoryUrl": "https://code.example.org/notes",
      "documentationUrl": "https://docs.example.org/notes",
      "tags": ["notes"],
      "permissions": ["example.notes.read", "example.notes.write"],
      "dependencies": [],
      "grants": [
        "core.records",
        "core.storage.local",
        "core.ui",
        "example.notes.read",
        "example.notes.write"
      ],
      "platforms": ["browser", "desktop", "ios", "android"]
    }
  ]
}
```

The example checksum/key are placeholders; published entries must contain real values. `plugins.schema.json` is the machine-readable format. The SDK's `inventorySchema` also rejects duplicate IDs and missing publisher keys. `permissions`, `dependencies`, and descriptive fields must match the signed manifest. `grants` is the sorted union of manifest permissions, all declared shared service IDs (including optional services), and consumed commands/events. These are capabilities the user reviews; optional services behind a feature flag still remain off until that feature is enabled. `platforms` describes supported entrypoints, not a guarantee that every device has every capability.

Configure a server with `PLUGIN_INVENTORY_URL=https://your-host/plugins.json`; the default is this repository's raw `main/plugins.json`. Configure local-only clients at build time with `VITE_PLUGIN_INVENTORY_URL`. Those clients download and verify directly. Hosts serving local-only clients must allow CORS GET requests from the app origin (public catalogs can use `Access-Control-Allow-Origin: *`). Connected clients download packages through their server and need no direct package-host access. URLs cannot contain credentials or fragments. HTTPS is required; `PLUGIN_ALLOW_HTTP=1` and the client's development mode permit local HTTP fixtures only.

The catalog is an administrator-selected trust source: its `publishers` keys authorize code installation. Control write access to it. A signature proves that a package came from that publisher; it does not make arbitrary plugin code safe. Browser plugins execute in the app origin, and a `core.server` grant permits trusted server code in the server process. They are not isolated sandboxes.

## Repository and package layout

Use one repository per optional plugin, for example `taskasaur-plugin-tasks`. Keep feature dependencies in that repository. Do not copy React, the core database, credential implementation, or shared UI components into a plugin.

```text
plugin.json                 # manifest below
schemas.json                # JSON array of record contracts
src/browser.tsx             # optional shared UI activation
src/server.ts               # optional trusted server hooks
scripts/build.mjs           # imports buildPlugin from the SDK
package.json / package-lock.json
types/host.d.ts              # reference to SDK host declarations
vendor/                     # pinned SDK archive and checksum provenance
LICENSE / README.md
```

All current plugins use TypeScript. Use Node 24 to build. Pin `@taskasaur/platform` (currently 0.3.0) and `esbuild` as development dependencies. The bundled SDK archive allows a plugin repository to build without sibling checkouts. `types/host.d.ts` contains:

```ts
/// <reference types="@taskasaur/platform/host-types" />
```

`scripts/build.mjs` contains:

```js
import { buildPlugin } from "@taskasaur/platform/build-plugin";
await buildPlugin();
```

`npm ci && npm run typecheck && npm run build` produces `dist/plugin.json`, `dist/schemas.json`, `dist/LICENSE`, and declared `.mjs` entrypoints. Dependencies are bundled with esbuild. Browser React, Dexie hooks, SDK helpers, and `@taskasaur/ui/*` imports are supplied by core. Feature CSS is embedded in the browser module and removed during deactivation. Bundle other dependencies; the server loader permits shared host imports and Node builtins, not arbitrary runtime npm resolution. Avoid packages that require unbundled files from `node_modules`.

The build output exports activation functions; it does not fetch or evaluate source code. The host validates the artifact before importing its module. `runner` is reserved in the manifest format; the supplied builder currently targets `browser` and `server`. Use core device commands and the shared TypeScript workflow engine for device execution.

## Manifest

The authoritative schema is `@taskasaur/platform/plugin-sdk`'s `manifestSchema`. Unknown top-level fields are rejected. Required properties:

| Field                                         | Contract                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`                                          | Stable lowercase ID, e.g. `example.notes`; never reuse another plugin's ID.                                       |
| `name`, `description`, `publisher`, `license` | Human-readable installation metadata; publisher matches the trusted signing key.                                  |
| `version`                                     | Three numeric components, e.g. `1.0.0`; publish a new version for any changed bytes.                              |
| `platformApi`, `fieldSchemaApi`               | Currently `^1.0.0`.                                                                                               |
| `entrypoints`                                 | Optional `browser` and/or `server` relative `.mjs` paths.                                                         |
| `ui`                                          | `{ "mode": "shared", "apiVersion": "^1.0.0", "surfaces": ["notes"] }`, or `mode: "none"`.                         |
| `storage.local`                               | `{ "mode": "dexie", "collections": ["example_notes_entries"] }`, or `mode: "none"` and empty collections.         |
| `permissions`                                 | Explicit plugin permissions, conventionally `<id>.read` and `<id>.write`.                                         |
| `dependencies`                                | IDs that must be installed and enabled first; core dependencies are already available.                            |
| `features`                                    | Named opt-ins with `defaultEnabled: false`.                                                                       |
| `sharedServices`                              | Each entry has `id`, `version: "^1"`, `optional`, and optional `when` feature name.                               |
| `provides`, `consumes`                        | Explicit `commands` and `events` arrays.                                                                          |
| `server`                                      | Optional routes, `background`, and `mutationHooks`; requires a server entrypoint and `core.server` service grant. |

Only signed platform releases replace required core providers. Existing first-party collection IDs are reserved for their original owner to preserve data during this extraction. New plugins use `<plugin_id_with_underscores>_<collection>` IDs. Their commands use the plugin namespace or the registered collection's `.list`, `.put`, and `.delete` names. New HTTP routes use `extensions/<plugin-id>/...`.

## Fields and shared storage

`schemas.json` is an array of `{id, pluginId, name, version, fields}` contracts. Each field uses the SDK PostgreSQL descriptor (`fieldDescriptor`), with `id`, `label`, `pgType`, required/nullability/default options and optional controls, choices, arrays, limits and references. Supported types are text, character varying, boolean, smallint, integer, bigint, numeric, double precision, uuid, date, timestamp with/without time zone, time without time zone, interval, jsonb and bytea. Large integers and exact decimals cross JSON boundaries as strings. Use the same descriptors in backend validation and shared frontend fields. Put standard-required calendar/reminder fields before optional fields. `standard: "ical-event"`, `"ical-alarm"`, or `"time-interval"` opts a contract into the corresponding core validation.

Core owns the PostgreSQL tables, resource ownership, revisions, migrations, offline Dexie database, outbox and synchronization. `core.storage.local` exposes only a plugin's declared collections plus namespaced cache metadata. Do not open a second Dexie database for records shared with core or write another plugin's SQL tables directly. Records use UUIDs and core resource envelopes. Uninstall preserves records; it disables the feature. Additive schema changes migrate on installation. Field/collection removal and version downgrades are refused and need an explicit migration design.

A simple browser module can use only `core.ui` and its shared table:

```tsx
import type { CoreContext } from "@taskasaur/platform/plugin-sdk";
export default {
  async activate(context: CoreContext) {
    const ui = context.services.require<any>("core.ui");
    return ui.registerSurface({
      id: "notes",
      label: "Notes",
      render: () =>
        ui.React.createElement(ui.RecordTable, {
          collection: "example_notes_entries",
        }),
    });
  },
};
```

Declare `notes` in `ui.surfaces` and the collection in `storage.local.collections`; declare the required `core.ui` service. The table supplies core filtering, sorting, forms, permission-aware edits and offline persistence. For custom views, use `@taskasaur/ui/fields` (`FieldInput`, `RecordForm`), `@taskasaur/ui/record-table`, and the host's locally maintained UI primitives. The `core.workspace` service offers the scoped `AppRuntime` facade declared by `@taskasaur/plugin-host`: collection methods, selected local record/file operations, declared plugin HTTP routes, profile, state and synchronization. Declare `core.sync` before synchronizing and `files.access` before file operations. Owned collection access stays scoped; cross-plugin writes/list calls use core commands and require declared/granted consumers.

## Core services and communication

Required core providers are versioned together: plugin lifecycle, messaging, records, local/synced storage, field schema, shared UI, files, variables, tables, credentials, identity/access, devices, jobs and notifications. Opt into only the service interfaces your feature needs. Services must be declared and granted before `context.services.require(id)` or `.optional(id)` can access them. An optional service tied to `when: "attachments"` is available only while that feature is enabled. Calling `optional` does not bypass declarations or grants.

All inter-plugin communication goes through `CoreContext.messages` and core's router. Do not import another plugin's implementation or keep a private peer connection. Commands use JSON-RPC 2.0 through `json-rpc-2.0`; events use CloudEvents through `cloudevents`. Both existing libraries are part of the SDK.

- `messages.handle(name, recordContract, handler)` registers a declared command and returns a cleanup function.
- `messages.call<T>(name, input, {mutationId?, targetDeviceId?})` invokes a declared consumer through core's permission checks and device routing.
- `messages.publish(type, resourceId, revision, value, operationId)` publishes a declared event tied to an authorized resource.
- `messages.subscribe(type, handler)` subscribes to a declared consumer and returns cleanup.

Use stable operation IDs for retries; react to committed events rather than assuming delivery is exactly once. Cleanup on deactivation and respect `context.signal`. Core validates inputs, resource access and enabled state. Collection CRUD commands are registered automatically from declared schemas/provided names.

Credentials are core resources, referenced by UUID. Server plugins use the shared `CredentialBroker` with scoped principal, plugin permission and destination checks. Keep secret material out of schemas, plugin ZIPs, events, browser storage and log metadata. Files use core's versioned file service. Long-running work uses core jobs; linked computers use core device identities, capability checks and online leases. An automation specifies its target device. Every client uses the same plugin UI; disable a capability when the selected device cannot provide it (e.g. inbound iOS terminal hosting).

## Server hooks

Declare `core.server` as a required shared service to opt into the trusted server adapter. The builder supplies `@taskasaur/server-host` imports for the shared Repository, CredentialBroker, FileService, JobService and DeviceService. Browser code cannot import server implementations. Host type declarations ship in the SDK, without server JavaScript.

```ts
export function createBackend(core: any) {
  return {
    async http(request: Request, path: string, { repo, principal }: any) {
      await repo.requirePlugin(principal, "example.notes");
      return Response.json({ ok: true });
    },
    async tick({ repo, workspaceId }: any) {
      /* idempotent background work */
    },
    async beforeMutation({ repo, principal, mutation, data, schema }: any) {},
    async afterMutation({
      repo,
      principal,
      mutation,
      data,
      schema,
      record,
    }: any) {},
  };
}
export default {
  async activate(context: any) {
    /* optional core message handlers */
  },
};
```

A route declaration is `{path:"extensions/example.notes/status", methods:["GET"], authentication:"workspace"}`. Workspace routes require authenticated membership and the plugin enabled in that workspace; handlers still enforce resource-level authorization through core. `authentication:"plugin"` is for webhooks: the handler must authenticate a scoped, revocable token and check its workspace/plugin before reading or changing anything. Core invokes the matching handler only. Background ticks run only for enabled workspaces. Mutation hooks run around the owning collection's mutation in the same database transaction. Do not perform external side effects inside that transaction; enqueue an idempotent core job.

## Build, sign, publish, add

1. Create the separate plugin repository and implement its manifest, contracts, entrypoint and README. Use a current plugin as a complete build example. Run typecheck/build and test lifecycle, offline data, permission failures and dependencies.
2. Generate a publisher key once in a private directory with `npm run plugins -- keygen /private/path/publisher` from `taskasaur-server`. Retain the private key outside Git. Add only its public PEM to the catalog's `publishers` map after review.
3. Run `npm run plugins -- pack /path/to/plugin/dist /private/path/publisher/private.pem /path/to/plugin.zip`. This signs a canonical file index with Ed25519 and includes SHA-256 and size for every file.
4. Upload the resulting ZIP to an immutable HTTPS URL. GitHub is optional. The current first-party releases use tagged raw URLs in each plugin repository; any CORS-enabled static host works. Publish source and dependency license notices alongside the package.
5. Compute the ZIP's SHA-256 (e.g. `shasum -a 256 plugin.zip`) and add/update its entry in `plugins.json`. Copy metadata from the signed manifest and use `inventoryGrants(manifest)` from the SDK for capabilities. List each dependency in the same catalog or use a required core ID.
6. Run this repository's `npm ci && npm run validate`. Run `npm run verify-downloads` once URLs are online; it downloads each artifact and checks the manifest, permissions, hash, signature and schemas against the inventory. Submit the JSON/public-key/docs change for review.

The installer bounds download/expanded size (50 MiB), metadata size, file count, timeouts and redirects; rejects traversal, symlinks and unlisted entries; verifies signatures and checksums before installation; and requires reviewed grants. Installation stages files, migrates schemas and atomically replaces the package inventory. Server package storage is a persistent Docker volume and survives an image pull/recreation. Do not overwrite a released version with different bytes; increment its version. Updating retains data and feature choices, but server-side package code is shared across workspaces on that server, so update review is an administrative responsibility. Back up database and plugin volume together before schema-changing upgrades; destructive migrations and automatic downgrade rollback are not implemented.

Server operators can run `npm run plugins -- inventory`, then `npm run plugins -- install-id <id> <reviewed-capability> ...`. Include the capabilities of dependencies too. `install-url <https-url> <trust.json> <reviewed-capability> ...` installs from a URL outside a catalog; install dependencies first. `install <zip> <trust.json> ...`, `verify <zip> <trust.json>`, and `list` remain available. Workspace owners can install from the app instead. API clients send `POST /api/plugins/install` with `{id, version, sha256, grants}`; the server rejects a changed catalog release and requires another review. `GET /api/plugins/packages` returns verified installed contracts, not a hardcoded optional catalog.

Existing workspaces retain collection IDs, plugin state and records. On first connected use, old optional features can obtain their signed package through the inventory. Core can start without downloading any optional plugin. Previously downloaded browser modules/contracts are cached for offline use. If an inventory is unreachable, installed packages remain usable; installing a new one requires connectivity. A local-only workspace can use browser features, while SMTP, IMAP, hosted webhooks and other backend capabilities require a connected server.
