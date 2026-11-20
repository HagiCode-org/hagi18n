# Locale Layout

Read this when checking whether a repository's locale files fit what the toolkit expects, or when a parse error or an alias question comes up.

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

## Next

- Point the toolkit at the tree -> [`config.md`](config.md)
- Repository scan for legacy locale references -> [`doctor.md`](doctor.md)
