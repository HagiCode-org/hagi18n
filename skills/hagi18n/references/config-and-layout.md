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
