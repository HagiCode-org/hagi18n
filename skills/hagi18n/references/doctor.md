# Doctor Scan

Read this when `doctor` reports legacy locale references, or when its scan needs tuning (extra directories, extensions, allowlist entries).

`doctor` runs the audit flow and then scans text files in the repository for legacy locale references. Settings live under `doctor:` in `hagi18n.yaml` (see [`config.md`](config.md)).

## Current defaults

Default excluded directories:

- `.git`
- `coverage`
- `dist`
- `indexGenerator`
- `node_modules`
- `public`

Default text file extensions:

- `.cjs`
- `.js`
- `.jsx`
- `.md`
- `.mjs`
- `.ts`
- `.tsx`

Default excluded path prefixes:

- `src/generated/`

Default built-in scan rules look for:

- legacy `src/locales/en/` style paths
- `changeLanguage("en")` style canonical language switches
- `language: "en"` style canonical language literals
- `'en' | 'zh-CN'` style unions and casts

## Exemptions

`doctor.allowlist` maps a rule id to source file paths that are exempt from that rule. It does not affect audit output; for audit exemptions use `auditIdenticalAllowlist` in [`config.md`](config.md).

## Source of truth

When the user needs exact behavior, inspect `src/config.ts` (defaults and rules) and `src/locale-toolkit.ts` (scanning).
