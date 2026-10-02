# Taskasaur plugin inventory

[`plugins.json`](plugins.json) is the public catalog used by the Taskasaur server and the app's plugin installer. It contains display metadata, explicit dependencies/capabilities, publisher public keys, and a signed ZIP download URL/checksum for each optional plugin. Installation is independent of GitHub; any HTTPS host can serve the JSON and packages.

Optional source code lives in one repository per plugin. Required storage, credentials, messaging and other core providers ship with Taskasaur.

See the [plugin specification](docs/plugin-specification.md) for creating a plugin, the core interfaces, building/signing packages, self-hosting the inventory, and adding a release. The machine-readable format is [`plugins.schema.json`](plugins.schema.json).

```sh
npm ci
npm run validate
npm run verify-downloads
```

Set `PLUGIN_INVENTORY_URL` on your server to use a different catalog; local-only clients use `VITE_PLUGIN_INVENTORY_URL` at build time. No repository API or account is needed to download a plugin.

## Current plugins

- [Tasks](https://github.com/taskasaur/taskasaur-plugin-tasks): Tasks, subtasks, dependencies, and boards.
- [Track](https://github.com/taskasaur/taskasaur-plugin-track): Activity history, measurements, and presets.
- [Time](https://github.com/taskasaur/taskasaur-plugin-time): Timers, intervals, focus, and breaks.
- [Calendar](https://github.com/taskasaur/taskasaur-plugin-calendar): Events, recurrence, and standards-based calendar import/export.
- [Reminders](https://github.com/taskasaur/taskasaur-plugin-reminders): Scheduled reminders with required iCalendar fields.
- [Email Client](https://github.com/taskasaur/taskasaur-plugin-email-client): Mail accounts, mailbox sync, drafts, attachments, and send/receive.
- [Automation Runtime](https://github.com/taskasaur/taskasaur-plugin-automation-runtime): TypeScript workflows executed on an explicitly selected device.
- [Automation Editor](https://github.com/taskasaur/taskasaur-plugin-automation-editor): Visual workflow editor and execution history.
- [Remote Terminal](https://github.com/taskasaur/taskasaur-plugin-remote-terminal): Authorized interactive shells on connected computers.
- [Office Editor](https://github.com/taskasaur/taskasaur-plugin-office-editor): Offline documents, spreadsheets, and presentations.
- [Sharing](https://github.com/taskasaur/taskasaur-plugin-sharing): Scoped resource sharing and permissions.
- [Connector Github](https://github.com/taskasaur/taskasaur-plugin-connector-github): GitHub issues and actions through shared credentials.
