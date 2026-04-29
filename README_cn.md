# Hagi18n

`@hagicode/hagi18n` 是面向未来 HagiCode 国际化能力的 scoped npm 包基础仓库。当前版本刻意保持为最小骨架，只提供包元数据、基础 runtime-info API，以及一个可构建、可测试、可发布的 CLI 占位实现。

当前基础框架来自 `hagiscript`，后续再逐步补充真正的 i18n 代码内容。

## 安装前提

- 需要 Node.js 20 或更高版本。
- 当前仓库使用 npm 作为包管理器。
- npm 包名为 `@hagicode/hagi18n`。

## 使用方式

从 npm 安装：

```bash
npm install @hagicode/hagi18n
```

安装后的 CLI 命令为 `hagi18n`。

本地开发时运行：

```bash
npm run dev -- --help
npm run dev -- info
```

构建后运行编译产物：

```bash
npm run build
node dist/cli.js --version
node dist/cli.js info
```

ESM 场景下可直接使用导出 API：

```ts
import { createRuntimeInfo, getPackageMetadata } from "@hagicode/hagi18n";

console.log(getPackageMetadata());
console.log(createRuntimeInfo());
```

## 开发命令

在 `repos/hagi18n/` 下执行：

```bash
npm install
npm run lint
npm run format:check
npm test
npm run build
npm run pack:check
```

其他常用命令：

```bash
npm run clean
npm run format
npm run test:watch
```
