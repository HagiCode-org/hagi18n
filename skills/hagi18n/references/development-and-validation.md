# Development And Validation

## Repository-local commands

Run these from `repos/hagi18n`:

```bash
npm test
npm run build
npm run lint
npm run pack:check
```

Useful package maintenance helpers:

```bash
npm run publish:check-prereqs
npm run publish:prepare-dev-version
npm run publish:verify-release
```

## Source map

- `src/cli.ts`: command registration, option parsing, summary output, and exit code wiring
- `src/config.ts`: config discovery, YAML parsing, defaults, doctor rules, and config resolution
- `src/locale-toolkit.ts`: file walking, YAML reads, placeholder checks, doctor scanning, and mutation planning
- `src/index.ts`: public exports for API consumers
- `src/__tests__/`: CLI, config, index, and locale toolkit coverage

## Packaging notes

- Published files are controlled by `package.json`.
- When adding AI-facing skill content or other runtime-relevant docs, keep package contents aligned with the `files` allowlist.
- The package is ESM and exports the CLI binary from `dist/cli.js`.

## Validation expectations after edits

- Run the narrowest relevant tests first if the change is isolated.
- Run `npm test` after source or skill-related packaging changes.
- Run `npm run build` after TypeScript or export changes.
- Run `npm run pack:check` when package contents or publish-facing files change.

## Behavior references

The package preserves the Web maintenance model:

- `repos/web/buildTools/lib/i18nLocaleToolkit.mjs` -> `src/locale-toolkit.ts`
- `repos/web/buildTools/i18n-locale-cli.mjs` -> `src/cli.ts`

Use the local source tree as the writable source of truth and treat the Web mapping as historical context only.
