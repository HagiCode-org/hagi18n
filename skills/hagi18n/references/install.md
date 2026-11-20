# Install

Read this only when the CLI is missing, the version is in doubt, or the user asks how to set it up. If `hagi18n` or `npx` already works, skip it.

Requirements: Node.js 24 or newer (`engines.node` is `>=24.0.0`).

## Run without installing

Preferred for one-off use and agent runs:

```bash
npx @hagicode/hagi18n --help
```

## Install into a consumer repository

This provides the `hagi18n` command (the `bin` name):

```bash
npm install @hagicode/hagi18n
# or, in a pnpm repository
pnpm add -D @hagicode/hagi18n
```

Check the install with `hagi18n info` (or `npx @hagicode/hagi18n info`), which prints package metadata and runtime info.

## Notes

- Do not install it globally just to run a check; use `npx` or a project dependency so the version is pinned per repository.
- The TypeScript API is exported from the same package (`import { auditLocaleTree } from "@hagicode/hagi18n"`). This skill covers the CLI.
- A source checkout of `repos/hagi18n` uses pnpm (`corepack enable`, then `pnpm install`). See [`development-and-validation.md`](development-and-validation.md).

## Next

- Run commands -> [`cli-workflows.md`](cli-workflows.md)
- Write the config file -> [`config.md`](config.md)
