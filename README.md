# Hagi18n

`@hagicode/hagi18n` is the scoped npm package foundation for future HagiCode internationalization tooling. This repository currently keeps behavior intentionally small: it exposes package metadata, a baseline runtime-info API, and an executable CLI placeholder that can be built, tested, and published safely.

This initial scaffold is derived from the `hagiscript` package foundation. i18n-specific implementation will be added later.

## Installation Assumptions

- Node.js 20 or newer is required.
- npm is the package manager for this standalone repository.
- The npm package name is `@hagicode/hagi18n`.

## Usage

Install the package from npm:

```bash
npm install @hagicode/hagi18n
```

The installed CLI command is `hagi18n`.

Run the CLI locally during development:

```bash
npm run dev -- --help
npm run dev -- info
```

After building, run the compiled CLI:

```bash
npm run build
node dist/cli.js --version
node dist/cli.js info
```

Use the library API from ESM consumers:

```ts
import { createRuntimeInfo, getPackageMetadata } from "@hagicode/hagi18n";

console.log(getPackageMetadata());
console.log(createRuntimeInfo());
```

## Development Commands

Run all commands from `repos/hagi18n/`:

```bash
npm install
npm run lint
npm run format:check
npm test
npm run build
npm run pack:check
```

Additional commands:

```bash
npm run clean
npm run format
npm run test:watch
```

## Build Outputs

`npm run build` compiles TypeScript into `dist/`. Expected entry points include:

- `dist/index.js`
- `dist/index.d.ts`
- `dist/index.js.map`
- `dist/cli.js`
- `dist/cli.d.ts`
- `dist/cli.js.map`

The package `exports` field points consumers to `dist/index.js` and `dist/index.d.ts`. The published package name is `@hagicode/hagi18n`, and the `bin.hagi18n` entry points to `dist/cli.js`.
