# Hagi18n

[![npm version](https://img.shields.io/npm/v/%40hagicode%2Fhagi18n?logo=npm&color=cb3837)](https://www.npmjs.com/package/@hagicode/hagi18n)
[![npm downloads](https://img.shields.io/npm/dm/%40hagicode%2Fhagi18n?logo=npm&color=2d8cf0)](https://www.npmjs.com/package/@hagicode/hagi18n)
[![license](https://img.shields.io/badge/license-MIT-ffd43b)](./LICENSE)

`@hagicode/hagi18n` is a reusable YAML locale maintenance toolkit for HagiCode projects. It was abstracted from the mature Web workflow in `repos/web/buildTools`, but it runs as an independent package and CLI.

It supports:

- Auditing locale trees for missing files, extra files, missing keys, extra keys, placeholder mismatches, parse errors, and protected tokens.
- Repository hygiene checks for legacy locale references.
- Safe `sync` and `prune` mutations with dry-run defaults.
- Optional `hagi18n.yaml` defaults so each project can define its own locale layout.

## AI Skill

This repository now ships a local Codex-style skill at [`skills/hagi18n/SKILL.md`](skills/hagi18n/SKILL.md).

Use it when an AI agent needs to:

- run or explain `hagi18n audit`, `doctor`, `sync`, or `prune`
- add or review a `hagi18n.yaml` file
- inspect or modify the source in `repos/hagi18n`
- validate locale maintenance workflows against a consumer repository

The skill includes focused references for command usage, configuration, and package development.

## Requirements

- Node.js 20 or newer
- npm for package management

## Installation

```bash
npm install @hagicode/hagi18n
```

The installed CLI command is `hagi18n`.

## YAML Locale Layout

The package expects a locale tree like this:

```text
src/locales/
  en-US/
    common.yml
    features/editor.yml
  zh-CN/
    common.yml
    features/editor.yml
```

Supported files:

- `.yml`
- `.yaml`

Supported values:

- top-level mapping documents
- nested objects
- arrays
- scalar translation leaves
- `{{placeholder}}` interpolation tokens

Common locale aliases such as `en`, `en-us`, `zh`, and `zh-cn` are accepted and normalized to canonical locale names like `en-US` and `zh-CN`.

## Configuration

By default, the CLI looks for `hagi18n.yaml` in the current working directory. You can also pass `--config <path>`.

Example:

```yaml
localesRoot: src/locales
repoRoot: .
baseLocale: en-US
targetLocales:
  - zh-CN
doctor:
  excludedDirectories:
    - .git
    - dist
    - node_modules
  textFileExtensions:
    - .ts
    - .tsx
    - .js
    - .md
  allowlist:
    legacy-language-change-call:
      - src/legacy-test.ts
```

Precedence is:

1. CLI flags or direct API options
2. `hagi18n.yaml`
3. package defaults

Relative paths in `hagi18n.yaml` are resolved from the config file directory.

## CLI Commands

```bash
hagi18n info
hagi18n audit
hagi18n report
hagi18n doctor
hagi18n sync
hagi18n prune
```

Examples:

```bash
hagi18n audit --locales-root src/locales --base-locale en-US
hagi18n audit --config hagi18n.yaml --json
hagi18n report --config hagi18n.yaml
hagi18n doctor --config hagi18n.yaml
hagi18n sync --from en-US --to zh-CN
hagi18n sync --from en-US --to zh-CN --write
hagi18n prune --from en-US --to zh-CN --write
```

`sync` and `prune` are dry-run by default. Pass `--write` to mutate files.

## Option Reference

| Option | Commands | Description |
| --- | --- | --- |
| `--config <path>` | all except `info` | Load defaults from a config file |
| `--locales-root <path>` | audit, report, doctor, sync, prune | Locale root directory |
| `--base-locale <locale>` | audit, report, doctor | Base locale for comparison |
| `--from <locale>` | sync, prune | Base locale for mutation commands |
| `--locale <locale>` | audit, report, doctor | Limit output to one or more locales |
| `--to <locale>` | sync, prune | Limit mutations to one or more target locales |
| `--repo-root <path>` | doctor | Repository root for repository scanning |
| `--json` | audit, doctor, sync, prune | Print JSON instead of text |
| `--dry-run` | sync, prune | Preview mutations without writing files |
| `--write` | sync, prune | Apply mutations to disk |

## JSON Output and Exit Codes

- `audit` returns exit code `0` when clean and `1` when issues exist.
- `report` runs the same audit and always prints JSON.
- `doctor` returns exit code `1` when audit issues or repository scan issues exist.
- `sync` and `prune` return exit code `1` only for parse or processing errors. Planned or applied mutations are reported in the summary.
- Command parsing failures return exit code `1` from the current `commander` integration.

The JSON payload is the same structured summary returned by the TypeScript API.

## TypeScript API

```ts
import {
  auditLocaleTree,
  doctorLocaleTree,
  formatAuditSummary,
  pruneLocaleTree,
  resolveHagi18nConfig,
  syncLocaleTree
} from "@hagicode/hagi18n";

const audit = await auditLocaleTree({
  localesRoot: "src/locales",
  baseLocale: "en-US"
});

console.log(formatAuditSummary(audit));
```

Main exports include:

- configuration helpers such as `findHagi18nConfigPath`, `loadHagi18nConfig`, and `resolveHagi18nConfig`
- locale helpers such as `normalizeLocaleName`, `listLocaleDirectories`, and `readYamlLocaleFile`
- workflows such as `auditLocaleTree`, `doctorLocaleTree`, `syncLocaleTree`, and `pruneLocaleTree`
- text formatters such as `formatAuditSummary`, `formatDoctorSummary`, and `formatMutationSummary`
- package metadata helpers such as `getPackageMetadata` and `createRuntimeInfo`

## Web Reference Mapping

This package preserves the maintenance model from the Web repository:

- `repos/web/buildTools/lib/i18nLocaleToolkit.mjs` -> `src/locale-toolkit.ts`
- `repos/web/buildTools/i18n-locale-cli.mjs` -> `src/cli.ts`

The Web project remains the behavior reference, but it does not need runtime changes to use this package later.

## Development

Run commands from `repos/hagi18n/`:

```bash
npm install
npm test
npm run build
```

## License

MIT. See [LICENSE](./LICENSE).
