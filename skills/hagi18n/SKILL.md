---
name: hagi18n
description: Use when the user wants to audit, doctor, sync, prune, configure, or modify YAML locale maintenance workflows powered by @hagicode/hagi18n, including package usage in other repositories and source changes in repos/hagi18n.
---

# Hagi18n

Use this skill when the task is to:

- run or explain the `hagi18n` CLI
- add, review, or fix a `hagi18n.yaml` configuration
- inspect locale drift, placeholder mismatches, or legacy locale references
- modify `@hagicode/hagi18n` source, tests, or release packaging in `repos/hagi18n`

## Core rules

- Prefer package-first usage for consumer repositories: `npx @hagicode/hagi18n <command>` or the installed `hagi18n` binary.
- Run build, test, and development commands with the working directory set to `repos/hagi18n`.
- `sync` and `prune` are dry-run by default. Only add `--write` when the user explicitly wants file mutations.
- Prefer canonical locale names such as `en-US` and `zh-CN`; aliases like `en`, `en-us`, `zh`, and `zh-cn` are normalized by the toolkit, but new code and docs should use canonical names.
- Use this package for locale maintenance and repository hygiene. Do not treat it as a runtime translation loader or UI i18n framework.

## Choose the workflow

1. Command usage in a consumer repository -> read [`references/cli-workflows.md`](references/cli-workflows.md)
2. Locale layout, config shape, or doctor scan behavior -> read [`references/config-and-layout.md`](references/config-and-layout.md)
3. Source changes, tests, or package validation in `repos/hagi18n` -> read [`references/development-and-validation.md`](references/development-and-validation.md)

## Source of truth

- CLI entry point: `src/cli.ts`
- Config loading and default rules: `src/config.ts`
- Audit, doctor, sync, and prune behavior: `src/locale-toolkit.ts`

## References

- [`references/cli-workflows.md`](references/cli-workflows.md) - package usage, command intent, exit code expectations, and mutation safety
- [`references/config-and-layout.md`](references/config-and-layout.md) - supported locale tree layout, `hagi18n.yaml` shape, aliases, and doctor defaults
- [`references/development-and-validation.md`](references/development-and-validation.md) - repository-local scripts, source map, and expected validation after edits
