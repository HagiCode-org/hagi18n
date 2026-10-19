# Hagi18n - Agent Configuration

## Root Configuration

Inherits all behavior from `/AGENTS.md` at the monorepo root. Local rules extend or override the root file for this repository.

## Project Context

`@hagicode/hagi18n` is a reusable YAML locale maintenance toolkit for HagiCode projects. It supports auditing, syncing, pruning, and validating locale trees across HagiCode repositories. Published on npm.

## Working Directory

Run commands from `repos/hagi18n/`.

## Key Commands

```bash
npm install
npm run build
npm test
npm run lint
npm run format:check
npm run dev -- <command>   # run the CLI from source via tsx (src/cli.ts)
npm run pack:check    # verify npm tarball contents (also run in CI and publish)
```

Requires Node.js 24 or newer. CI runs `npm test`, `npm run build`, and `npm run pack:check` on Linux, Windows, and macOS.

## Key Paths

- `src/`: CLI (`cli.ts`) and library source (`config.ts`, `locale-toolkit.ts`); tests in `src/__tests__/`
- `scripts/`: npm publish helpers (`verify-package.mjs`, `prepare-dev-version.mjs`, `verify-release-version.mjs`, `verify-npm-publish-prereqs.mjs`)
- `skills/hagi18n/SKILL.md`: AI-oriented skill documentation
- `dist/`: published build output

## Agent Guidelines

- Treat this as a published npm package; avoid breaking changes without version bumps.
- Keep the `hagi18n audit | sync | prune | doctor | report` command surface stable (plus the `info` runtime-info command).
- Publishing is workflow-driven (`npm-publish.yml`): every push to `main` publishes a `dev` dist-tag prerelease, a published non-prerelease GitHub release publishes `latest` after the tag matches the package version; do not publish by hand. Release drafts come from `release-draft-action.yml`.
- `hagi18n.yaml` options (`auditBaseLocales`, `auditIdenticalAllowlist`, `doctor.*`) are documented in `README.md`; keep the README option reference in sync when changing config behavior.
- For AI-oriented i18n guidance, consult `skills/hagi18n/SKILL.md`.
- If changing locale file conventions, update all consuming HagiCode repos.

## References

- `README.md`
- `skills/hagi18n/SKILL.md`
