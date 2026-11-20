# Config

Read this when adding, reviewing, or fixing a `hagi18n.yaml`, or when a flag and the file seem to disagree.

By default the CLI looks for `hagi18n.yaml` or `hagi18n.yml` in the current working directory. Relative paths are resolved from the config file directory. `--config <path>` overrides the lookup.

## Minimal example

```yaml
localesRoot: src/locales
repoRoot: .
baseLocale: en-US
targetLocales:
  - zh-CN
```

## Extended example

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
  excludedPathPrefixes:
    - src/generated/
  allowlist:
    legacy-language-change-call:
      - src/legacy-test.ts
```

The `doctor.*` keys are explained in [`doctor.md`](doctor.md).

## Precedence

1. CLI flags or direct API options
2. `hagi18n.yaml` or `hagi18n.yml`
3. package defaults

## Audit identical-value allowlist

`auditIdenticalAllowlist` exempts exact translation values that are meant to equal the English baseline, such as brand names or technical identifiers. It maps a locale-relative YAML file path (forward slashes) to dot-separated scalar key paths:

```yaml
auditIdenticalAllowlist:
  common.yml:
    - brand.name
  pages/home.yml:
    - hero.cta
```

- It suppresses only the `baselineValueMatches` entry for the exact file and key path. It applies to every target locale and does not change any other audit check.
- It does not accept globs, patterns, or value-based rules.
- It is not `doctor.allowlist`. `doctor.allowlist` filters repository-scan findings by rule id and source file path and does not affect audit output.
- Across config layers, a higher-precedence list for a file replaces the lower-precedence list for that file. Files defined only in the lower layer keep their lists.
- When absent, the resolved allowlist is `{}` and audit output is unchanged.

## Source of truth

`src/config.ts` for discovery, defaults, and resolution.
