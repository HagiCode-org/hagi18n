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
```

## Key Paths

- `src/`: CLI and library source
- `skills/hagi18n/SKILL.md`: AI-oriented skill documentation
- `dist/`: published build output

## Agent Guidelines

- Treat this as a published npm package; avoid breaking changes without version bumps.
- Keep the `hagi18n audit | sync | prune | doctor | report` command surface stable.
- For AI-oriented i18n guidance, consult `skills/hagi18n/SKILL.md`.
- If changing locale file conventions, update all consuming HagiCode repos.

## References

- `README.md`
- `skills/hagi18n/SKILL.md`
