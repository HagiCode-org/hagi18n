---
name: hagi18n
description: Use when the user wants to audit, doctor, sync, prune, configure, or modify YAML locale maintenance workflows powered by @hagicode/hagi18n, including package usage in other repositories and source changes in repos/hagi18n.
---

# Hagi18n

`@hagicode/hagi18n` is the YAML locale maintenance CLI: `audit`, `report`, `doctor`, `sync`, `prune`, `info`. Run it with `npx @hagicode/hagi18n <command>` or the installed `hagi18n` binary.

## Core rules

- `sync` and `prune` are dry-run by default. Add `--write` only when the user explicitly wants files changed.
- Use canonical locale names (`en-US`, `zh-CN`) in new code, config, and docs.
- This is locale maintenance and repository hygiene, not a runtime translation loader or UI i18n framework.
- Run build, test, and dev commands from `repos/hagi18n`.

## Read only what the task needs

| Task | Read |
|---|---|
| CLI not installed, or version / Node requirement in doubt | [`references/install.md`](references/install.md) |
| Run or explain a command, flags, exit codes | [`references/cli-workflows.md`](references/cli-workflows.md) |
| Write or fix `hagi18n.yaml`, precedence, identical-value allowlist | [`references/config.md`](references/config.md) |
| Locale tree shape, supported YAML, aliases | [`references/layout.md`](references/layout.md) |
| `doctor` findings, scan defaults, `doctor.allowlist` | [`references/doctor.md`](references/doctor.md) |
| Change source, tests, or packaging in `repos/hagi18n` | [`references/development-and-validation.md`](references/development-and-validation.md) |

Start with the single row that matches. Each reference ends with a short "Next" list; follow it only if the task continues there.

## Source of truth

- `src/cli.ts`: command registration and exit codes
- `src/config.ts`: config loading and default rules
- `src/locale-toolkit.ts`: audit, doctor, sync, and prune behavior
