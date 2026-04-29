import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditLocaleTree,
  doctorLocaleTree,
  listLocaleDirectories,
  normalizeLocaleName,
  readYamlLocaleFile,
  pruneLocaleTree,
  syncLocaleTree
} from "../index.js";
import {
  createTempProject,
  readProjectFile,
  writeLocaleFile,
  writeProjectFile
} from "./helpers.js";

async function createBasicLocalesFixture() {
  const project = await createTempProject("hagi18n-toolkit-");
  await writeLocaleFile(
    project.localesRoot,
    "en-US",
    "common.yml",
    `greetings:
  hello: "Hello {{name}}"
  bye: "Bye"
nested:
  child: "value"
items:
  - one
`
  );
  await writeLocaleFile(
    project.localesRoot,
    "en-US",
    "feature/base-only.yml",
    `value: "Base only"
`
  );
  await writeLocaleFile(
    project.localesRoot,
    "en-US",
    "protected.yml",
    `safe: "Safe"
`
  );

  await writeLocaleFile(
    project.localesRoot,
    "zh-CN",
    "common.yml",
    `greetings:
  hello: "你好 {{ user }}"
extraOnly: "额外"
items:
  - 一
`
  );
  await writeLocaleFile(
    project.localesRoot,
    "zh-CN",
    "extra.yml",
    `value: "Extra file"
`
  );
  await writeLocaleFile(
    project.localesRoot,
    "zh-CN",
    "protected.yml",
    `safe: "\uE000protected"
`
  );

  return project;
}

describe("locale toolkit", () => {
  it("discovers locale directories, normalizes aliases, and parses yaml files", async () => {
    const project = await createBasicLocalesFixture();

    expect(await listLocaleDirectories(project.localesRoot)).toEqual([
      "en-US",
      "zh-CN"
    ]);
    expect(normalizeLocaleName("en")).toBe("en-US");
    expect(normalizeLocaleName("zh-cn")).toBe("zh-CN");

    const document = await readYamlLocaleFile(project.localesRoot, "en-US", "common.yml");
    expect(document.data).toMatchObject({
      greetings: {
        hello: "Hello {{name}}",
        bye: "Bye"
      }
    });
  });

  it("reports non-mapping yaml parse errors", async () => {
    const project = await createTempProject("hagi18n-toolkit-parse-");
    await writeLocaleFile(project.localesRoot, "en-US", "array.yml", "- one\n- two\n");

    await expect(
      readYamlLocaleFile(project.localesRoot, "en-US", "array.yml")
    ).rejects.toThrow("Top-level YAML document must be a mapping object");
  });

  it("audits file drift, key drift, placeholder mismatches, and protected tokens", async () => {
    const project = await createBasicLocalesFixture();

    const summary = await auditLocaleTree({
      localesRoot: project.localesRoot,
      targetLocales: ["zh"]
    });

    expect(summary.baseLocale).toBe("en-US");
    expect(summary.locales).toEqual(["zh-CN"]);
    expect(summary.hasIssues).toBe(true);
    expect(summary.results[0]).toMatchObject({
      locale: "zh-CN",
      missingFiles: ["feature/base-only.yml"],
      extraFiles: ["extra.yml"],
      filesWithProtectedTokens: ["protected.yml"]
    });
    expect(summary.results[0].missingKeys).toEqual(
      expect.arrayContaining([
        { file: "common.yml", path: "greetings.bye" },
        { file: "common.yml", path: "nested.child" }
      ])
    );
    expect(summary.results[0].extraKeys).toEqual([
      { file: "common.yml", path: "extraOnly" }
    ]);
    expect(summary.results[0].placeholderMismatches).toEqual([
      {
        file: "common.yml",
        path: "greetings.hello",
        expected: ["{{name}}"],
        actual: ["{{ user }}"]
      }
    ]);
  });

  it("reports clean locale trees without issues", async () => {
    const project = await createTempProject("hagi18n-toolkit-clean-");
    const yamlText = `greetings:
  hello: "Hello {{name}}"
`;
    await writeLocaleFile(project.localesRoot, "en-US", "common.yml", yamlText);
    await writeLocaleFile(project.localesRoot, "zh-CN", "common.yml", yamlText);

    const summary = await auditLocaleTree({ localesRoot: project.localesRoot });

    expect(summary.hasIssues).toBe(false);
    expect(summary.results.every((result) => result.parseErrors.length === 0)).toBe(true);
  });

  it("syncs missing files and keys while preserving target translations", async () => {
    const project = await createTempProject("hagi18n-toolkit-sync-");
    await writeLocaleFile(
      project.localesRoot,
      "en-US",
      "common.yml",
      `title: "Hello"
nested:
  child: "Base child"
`
    );
    await writeLocaleFile(
      project.localesRoot,
      "en-US",
      "feature/new.yml",
      `enabled: "Enabled"
`
    );
    await writeLocaleFile(
      project.localesRoot,
      "zh-CN",
      "common.yml",
      `title: "你好"
extra: "保留"
`
    );

    const dryRun = await syncLocaleTree({
      localesRoot: project.localesRoot,
      targetLocales: ["zh-CN"]
    });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.changedFiles).toEqual(
      expect.arrayContaining([
        {
          locale: "zh-CN",
          file: "common.yml",
          action: "update",
          addedPaths: ["nested"]
        },
        {
          locale: "zh-CN",
          file: "feature/new.yml",
          action: "create",
          addedPaths: ["<entire-file>"]
        }
      ])
    );
    expect(await readProjectFile(project.root, "src/locales/zh-CN/common.yml")).toContain(
      'title: "你好"'
    );

    const written = await syncLocaleTree({
      localesRoot: project.localesRoot,
      targetLocales: ["zh-CN"],
      dryRun: false
    });

    expect(written.hasIssues).toBe(false);
    expect(await readProjectFile(project.root, "src/locales/zh-CN/common.yml")).toContain(
      "extra: 保留"
    );
    expect(await readProjectFile(project.root, "src/locales/zh-CN/common.yml")).toContain(
      "child: Base child"
    );
    expect(await readProjectFile(project.root, "src/locales/zh-CN/feature/new.yml")).toContain(
      "enabled: Enabled"
    );
  });

  it("prunes extra files and keys while preserving shared translations", async () => {
    const project = await createTempProject("hagi18n-toolkit-prune-");
    await writeLocaleFile(
      project.localesRoot,
      "en-US",
      "common.yml",
      `title: "Hello"
shared: "Keep"
`
    );
    await writeLocaleFile(
      project.localesRoot,
      "zh-CN",
      "common.yml",
      `title: "你好"
shared: "保留"
extra: "删除"
`
    );
    await writeLocaleFile(
      project.localesRoot,
      "zh-CN",
      "extra.yml",
      `value: "remove file"
`
    );

    const dryRun = await pruneLocaleTree({
      localesRoot: project.localesRoot,
      targetLocales: ["zh-CN"]
    });
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.removedFiles).toEqual([
      {
        locale: "zh-CN",
        file: "extra.yml",
        action: "remove-file"
      }
    ]);
    expect(dryRun.changedFiles[0]).toMatchObject({
      locale: "zh-CN",
      file: "common.yml",
      action: "update",
      removedPaths: ["extra"]
    });

    await pruneLocaleTree({
      localesRoot: project.localesRoot,
      targetLocales: ["zh-CN"],
      dryRun: false
    });

    await expect(readProjectFile(project.root, "src/locales/zh-CN/extra.yml")).rejects.toThrow();
    const current = await readProjectFile(project.root, "src/locales/zh-CN/common.yml");
    expect(current).toContain("title: 你好");
    expect(current).toContain("shared: 保留");
    expect(current).not.toContain("extra:");
  });

  it("combines audit and repository hygiene scanning with config-driven defaults", async () => {
    const project = await createTempProject("hagi18n-toolkit-doctor-");
    await writeProjectFile(
      project.root,
      "hagi18n.yaml",
      `localesRoot: app/locales
repoRoot: .
baseLocale: en-US
targetLocales:
  - zh-CN
doctor:
  allowlist:
    legacy-language-change-call:
      - src/allowed.ts
`
    );
    await writeLocaleFile(project.root + "/app/locales", "en-US", "common.yml", 'title: "Hello"\n');
    await writeLocaleFile(project.root + "/app/locales", "zh-CN", "common.yml", 'title: "你好"\n');
    await writeProjectFile(project.root, "src/problem.ts", "i18n.changeLanguage('en')\n");
    await writeProjectFile(project.root, "src/allowed.ts", "i18n.changeLanguage('en')\n");
    await writeProjectFile(project.root, "dist/ignored.ts", "i18n.changeLanguage('en')\n");
    await writeProjectFile(project.root, "src/generated/ignored.ts", "i18n.changeLanguage('en')\n");

    const summary = await doctorLocaleTree({ cwd: project.root });

    expect(summary.localesRoot).toBe(path.join(project.root, "app/locales"));
    expect(summary.audit.hasIssues).toBe(false);
    expect(summary.hasIssues).toBe(true);
    expect(summary.legacyReferenceIssues).toEqual([
      {
        ruleId: "legacy-language-change-call",
        file: "src/problem.ts",
        line: 1,
        message:
          "Use en-US when switching the canonical UI language in code or tests.",
        snippet: "i18n.changeLanguage('en')"
      }
    ]);
  });
});
