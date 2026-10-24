---
public: true
multilingual: true
languages:
  - en-US
  - zh-CN
sourceLanguage: en-US
style: product
---

# README requirements

## Product focus

- Introduce `@hagicode/hagi18n` as a CLI and TypeScript package that keeps YAML locale resources consistent across HagiCode projects: it audits locale trees, reports and diagnoses problems, and safely syncs and prunes locale files.
- Address developers who add the package to a project to maintain its translations; this repository is itself a developer-facing tool, so usage-level detail belongs in the README.
- Lead with the value: finding missing, extra and mismatched locale keys and fixing them with dry-run-first commands. Open with what the tool does, then installation and usage.

## Required content

- Keep the badges, the one-paragraph description with the list of capabilities, requirements, installation and the installed `hagi18n` command.
- Keep the YAML locale layout the tool expects, the `hagi18n.yaml` configuration, the CLI commands with examples, the option reference, JSON output and exit codes, the TypeScript API, the AI skill pointer and the license statement.
- Command names and options must match `src/`; the license statement must match `LICENSE` and `package.json`.

## README languages

- Maintain English in `README.md` and Simplified Chinese in `README_cn.md`, keeping the reciprocal language link and the existing filenames.
- Keep both files aligned in scope and meaning.

## Exclusions

- Exclude npm tokens, secret values, internal hosts, machine-specific paths and private links.
- Keep repository maintenance instructions out of the README: the Web reference mapping, internal architecture, CI, build internals and the development workflow.
