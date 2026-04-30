import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_LOCALE,
  loadHagi18nConfig,
  resolveHagi18nConfig
} from "../config.js";
import { createTempProject, writeProjectFile } from "./helpers.js";

describe("hagi18n config", () => {
  it("uses package defaults when no config file is present", async () => {
    const project = await createTempProject("hagi18n-config-defaults-");

    const result = await resolveHagi18nConfig({ cwd: project.root });

    expect(result.configPath).toBeNull();
    expect(result.localesRoot).toBe(path.join(project.root, "src", "locales"));
    expect(result.repoRoot).toBe(project.root);
    expect(result.baseLocale).toBe(DEFAULT_BASE_LOCALE);
    expect(result.auditBaseLocales).toEqual([DEFAULT_BASE_LOCALE]);
    expect(result.targetLocales).toEqual([]);
    expect(result.doctor.excludedDirectories).toContain("node_modules");
  });

  it("discovers hagi18n.yaml from the current working directory", async () => {
    const project = await createTempProject("hagi18n-config-discovery-");
    await writeProjectFile(
      project.root,
      "hagi18n.yaml",
      `localesRoot: app/locales
repoRoot: .
baseLocale: zh-CN
auditBaseLocales:
  - en
  - zh-cn
targetLocales:
  - en-US
doctor:
  excludedDirectories:
    - custom-dist
`
    );

    const result = await loadHagi18nConfig({ cwd: project.root });

    expect(result.configPath).toBe(path.join(project.root, "hagi18n.yaml"));
    expect(result.config).toEqual({
      localesRoot: "app/locales",
      repoRoot: ".",
      baseLocale: "zh-CN",
      auditBaseLocales: ["en", "zh-cn"],
      targetLocales: ["en-US"],
      doctor: {
        excludedDirectories: ["custom-dist"],
        textFileExtensions: undefined,
        excludedPathPrefixes: undefined,
        allowlist: undefined,
        scanRules: undefined
      }
    });
  });

  it("resolves an explicit config path relative to cwd", async () => {
    const project = await createTempProject("hagi18n-config-explicit-");
    await writeProjectFile(
      project.root,
      "config/tools/hagi18n.yaml",
      `localesRoot: ../custom-locales
repoRoot: ..
baseLocale: en-US
targetLocales:
  - zh-CN
`
    );

    const result = await resolveHagi18nConfig({
      cwd: project.root,
      configPath: "config/tools/hagi18n.yaml"
    });

    expect(result.configPath).toBe(path.join(project.root, "config/tools/hagi18n.yaml"));
    expect(result.localesRoot).toBe(path.join(project.root, "config/custom-locales"));
    expect(result.repoRoot).toBe(path.join(project.root, "config"));
    expect(result.targetLocales).toEqual(["zh-CN"]);
  });

  it("falls back to baseLocale when auditBaseLocales is absent", async () => {
    const project = await createTempProject("hagi18n-config-audit-fallback-");
    await writeProjectFile(
      project.root,
      "hagi18n.yaml",
      `baseLocale: zh-CN
`
    );

    const result = await resolveHagi18nConfig({ cwd: project.root });

    expect(result.baseLocale).toBe("zh-CN");
    expect(result.auditBaseLocales).toEqual(["zh-CN"]);
  });

  it("normalizes and dedupes auditBaseLocales with cli overrides taking precedence", async () => {
    const project = await createTempProject("hagi18n-config-audit-precedence-");
    await writeProjectFile(
      project.root,
      "hagi18n.yaml",
      `baseLocale: en-US
auditBaseLocales:
  - zh
  - en
  - zh-CN
`
    );

    const result = await resolveHagi18nConfig({
      cwd: project.root,
      auditBaseLocales: ["ja-JP", "en", "ja-jp", "zh"]
    });

    expect(result.baseLocale).toBe("en-US");
    expect(result.auditBaseLocales).toEqual(["ja-JP", "en-US", "zh-CN"]);
  });

  it("uses a cli baseLocale as the audit baseline when no auditBaseLocales override is provided", async () => {
    const project = await createTempProject("hagi18n-config-cli-base-fallback-");
    await writeProjectFile(
      project.root,
      "hagi18n.yaml",
      `baseLocale: zh-CN
auditBaseLocales:
  - zh-CN
  - ja-JP
`
    );

    const result = await resolveHagi18nConfig({
      cwd: project.root,
      baseLocale: "en"
    });

    expect(result.baseLocale).toBe("en-US");
    expect(result.auditBaseLocales).toEqual(["en-US"]);
  });

  it("throws on invalid yaml", async () => {
    const project = await createTempProject("hagi18n-config-invalid-yaml-");
    await writeProjectFile(project.root, "hagi18n.yaml", "localesRoot: [broken");

    await expect(loadHagi18nConfig({ cwd: project.root })).rejects.toThrow(
      `Failed to parse ${path.join(project.root, "hagi18n.yaml")}`
    );
  });

  it("throws on invalid top-level config shapes", async () => {
    const project = await createTempProject("hagi18n-config-invalid-shape-");
    await writeProjectFile(
      project.root,
      "hagi18n.yaml",
      `- localesRoot: src/locales
`
    );

    await expect(loadHagi18nConfig({ cwd: project.root })).rejects.toThrow(
      "must be a mapping object"
    );
  });

  it("applies cli and api overrides ahead of config values and defaults", async () => {
    const project = await createTempProject("hagi18n-config-precedence-");
    await writeProjectFile(
      project.root,
      "hagi18n.yaml",
      `localesRoot: config-locales
repoRoot: repo-from-config
baseLocale: zh-CN
targetLocales:
  - en-US
doctor:
  excludedDirectories:
    - vendor
`
    );

    const result = await resolveHagi18nConfig({
      cwd: project.root,
      localesRoot: "cli-locales",
      repoRoot: "cli-root",
      baseLocale: "en-US",
      targetLocales: ["ja-JP"]
    });

    expect(result.localesRoot).toBe(path.join(project.root, "cli-locales"));
    expect(result.repoRoot).toBe(path.join(project.root, "cli-root"));
    expect(result.baseLocale).toBe("en-US");
    expect(result.auditBaseLocales).toEqual(["en-US"]);
    expect(result.targetLocales).toEqual(["ja-JP"]);
    expect(result.doctor.excludedDirectories).toEqual(["vendor"]);
  });
});
