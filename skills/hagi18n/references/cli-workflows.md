# CLI Workflows

## Use cases

Use `@hagicode/hagi18n` when a repository stores locale files as YAML trees and needs a maintenance workflow instead of ad hoc scripts.

Common goals:

- audit locale drift against a canonical base locale
- scan the repository for legacy locale references
- fill in missing files or keys safely
- prune files or keys that no longer exist in the base locale

## Preferred invocation

In a consumer repository:

```bash
npx @hagicode/hagi18n audit --config hagi18n.yaml
```

If the package is already installed:

```bash
hagi18n doctor --config hagi18n.yaml
```

For development against the local source tree in `repos/hagi18n`:

```bash
cd repos/hagi18n
npm run dev -- audit --locales-root ../some-app/src/locales --base-locale en-US
```

## Command intent

- `info`: print package metadata and foundation status
- `audit`: compare locale files against a base locale and report drift
- `report`: run the audit flow and always print JSON
- `doctor`: run the audit flow and scan text files for legacy locale references
- `sync`: add missing files and keys from the base locale
- `prune`: remove files and keys that no longer exist in the base locale

## Mutation safety

- `sync` and `prune` default to dry-run behavior.
- Add `--write` only when the user clearly wants files changed.
- `--dry-run` wins over `--write` if both are present.
- `--to` can be repeated to limit mutations to specific target locales.

## Exit code expectations

- `audit`: `0` when clean, `1` when issues exist
- `report`: same behavior as `audit`, but always JSON
- `doctor`: `1` when audit issues or legacy reference issues exist
- `sync` and `prune`: `1` for parse or processing errors; planned or applied mutations still produce a structured summary

## Working assumptions

- The toolkit expects a base locale such as `en-US`.
- Locale aliases are accepted, but output and new config should prefer canonical locale names.
- JSON mode is appropriate when another tool or agent needs machine-readable results.
