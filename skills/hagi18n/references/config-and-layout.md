# Config And Layout

## Expected locale tree

The package works on a locale root containing per-locale directories:

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

Supported documents:

- top-level YAML mappings only
- nested objects
- arrays
- scalar translation leaves
- `{{placeholder}}` interpolation tokens

## Locale normalization

The toolkit currently normalizes these aliases:

- `en`, `en-us` -> `en-US`
- `zh`, `zh-cn` -> `zh-CN`

Prefer canonical values in code, tests, and docs even though aliases resolve correctly.

## Config file

By default the CLI looks for `hagi18n.yaml` or `hagi18n.yml` in the current working directory. Relative paths are resolved from the config file directory.

Minimal example:

```yaml
localesRoot: src/locales
repoRoot: .
baseLocale: en-US
targetLocales:
  - zh-CN
```

Extended example:

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

## Config precedence

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

## Current doctor defaults

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

When the user needs exact behavior, inspect `src/config.ts` and use that file as the source of truth.
