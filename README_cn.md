# Hagi18n

`@hagicode/hagi18n` 是一个可复用的 YAML 语言包维护工具，抽象自 `repos/web/buildTools` 中已经成熟的 Web i18n 工作流，但可以作为独立 npm 包和 CLI 使用。

它提供：

- 语言包树审计：缺失文件、多余文件、缺失 key、多余 key、占位符不匹配、解析错误、受保护 token 检测
- 仓库级 doctor 检查：扫描旧的 locale 引用方式
- 安全的 `sync` / `prune` 变更流程，默认 dry-run
- 可选的 `hagi18n.yaml` 项目配置，适配不同仓库目录结构

## AI Skill

仓库现在内置了一套本地 Codex 风格 skill，位置在 [`skills/hagi18n/SKILL.md`](skills/hagi18n/SKILL.md)。

当 AI 代理需要完成以下任务时，可以直接使用这套 skill：

- 执行或解释 `hagi18n audit`、`doctor`、`sync`、`prune`
- 新增或审查 `hagi18n.yaml`
- 检查或修改 `repos/hagi18n` 内源码
- 在消费方仓库中验证语言包维护流程

skill 内还附带了命令使用、配置结构和包开发流程的拆分参考文档。

## 前提

- Node.js 20 或更高版本
- 使用 npm 管理依赖

## 安装

```bash
npm install @hagicode/hagi18n
```

安装后可直接使用 `hagi18n` 命令。

## YAML 目录结构

默认语言包目录形态如下：

```text
src/locales/
  en-US/
    common.yml
    features/editor.yml
  zh-CN/
    common.yml
    features/editor.yml
```

支持：

- `.yml`
- `.yaml`
- 顶层为 mapping 的 YAML 文档
- 嵌套对象、数组、标量翻译值
- `{{placeholder}}` 占位符

像 `en`、`en-us`、`zh`、`zh-cn` 这样的常见别名会自动规范化为 `en-US`、`zh-CN`。

## 配置文件

CLI 默认会在当前工作目录查找 `hagi18n.yaml`。也可以显式传入 `--config <path>`。

示例：

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
  allowlist:
    legacy-language-change-call:
      - src/legacy-test.ts
```

优先级：

1. CLI 参数或直接 API 传参
2. `hagi18n.yaml`
3. 包内默认值

`hagi18n.yaml` 中的相对路径会相对于配置文件所在目录解析，因此不同项目可以用它自定义 `baseLocale`、`localesRoot`、`repoRoot` 和默认目标语言目录。

## CLI 命令

```bash
hagi18n info
hagi18n audit
hagi18n report
hagi18n doctor
hagi18n sync
hagi18n prune
```

示例：

```bash
hagi18n audit --locales-root src/locales --base-locale en-US
hagi18n audit --config hagi18n.yaml --json
hagi18n report --config hagi18n.yaml
hagi18n doctor --config hagi18n.yaml
hagi18n sync --from en-US --to zh-CN
hagi18n sync --from en-US --to zh-CN --write
hagi18n prune --from en-US --to zh-CN --write
```

`sync` 和 `prune` 默认不会写盘，只有传入 `--write` 才会真正修改文件。

## 参数说明

| 参数 | 命令 | 说明 |
| --- | --- | --- |
| `--config <path>` | `info` 之外所有命令 | 加载配置文件 |
| `--locales-root <path>` | audit, report, doctor, sync, prune | 语言包根目录 |
| `--base-locale <locale>` | audit, report, doctor | 审计时使用的基准语言 |
| `--from <locale>` | sync, prune | 变更时使用的基准语言 |
| `--locale <locale>` | audit, report, doctor | 限定一个或多个目标语言 |
| `--to <locale>` | sync, prune | 限定一个或多个目标语言 |
| `--repo-root <path>` | doctor | 仓库扫描根目录 |
| `--json` | audit, doctor, sync, prune | 输出 JSON |
| `--dry-run` | sync, prune | 仅预览，不写盘 |
| `--write` | sync, prune | 真正写入文件 |

## JSON 输出与退出码

- `audit`：无问题退出码为 `0`，有问题为 `1`
- `report`：执行与 `audit` 相同的检查，但默认输出 JSON
- `doctor`：审计或仓库扫描存在问题时返回 `1`
- `sync` / `prune`：只有解析或处理错误时返回 `1`，正常的预览或写入结果都会输出摘要

JSON 输出与 TypeScript API 返回的结构化 summary 保持一致。

## TypeScript API

```ts
import {
  auditLocaleTree,
  doctorLocaleTree,
  formatAuditSummary,
  pruneLocaleTree,
  resolveHagi18nConfig,
  syncLocaleTree
} from "@hagicode/hagi18n";

const audit = await auditLocaleTree({
  localesRoot: "src/locales",
  baseLocale: "en-US"
});

console.log(formatAuditSummary(audit));
```

主要导出包括：

- 配置辅助函数：`findHagi18nConfigPath`、`loadHagi18nConfig`、`resolveHagi18nConfig`
- locale 辅助函数：`normalizeLocaleName`、`listLocaleDirectories`、`readYamlLocaleFile`
- 核心流程：`auditLocaleTree`、`doctorLocaleTree`、`syncLocaleTree`、`pruneLocaleTree`
- 文本格式化函数：`formatAuditSummary`、`formatDoctorSummary`、`formatMutationSummary`
- 元数据函数：`getPackageMetadata`、`createRuntimeInfo`

## 与 Web 参考实现的对应关系

此包保留了 Web 项目的维护模型：

- `repos/web/buildTools/lib/i18nLocaleToolkit.mjs` -> `src/locale-toolkit.ts`
- `repos/web/buildTools/i18n-locale-cli.mjs` -> `src/cli.ts`

也就是说，这次抽象保留了 Web 的参考行为，但不会要求 `repos/web` 立即修改运行时代码。

## 开发

在 `repos/hagi18n/` 目录执行：

```bash
npm install
npm test
npm run build
```
