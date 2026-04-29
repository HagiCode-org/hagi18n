import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createCli, isCliEntrypoint, runCli } from "../cli.js";
import { createTempProject, readProjectFile, withCwd, writeLocaleFile, writeProjectFile } from "./helpers.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as {
  name: string;
  version: string;
};

describe("hagi18n CLI", () => {
  it("configures name, help, and version metadata", () => {
    const program = createCli();

    expect(program.name()).toBe("hagi18n");
    expect(program.helpInformation()).toContain("Hagi18n YAML locale maintenance toolkit.");
    expect(program.version()).toBe(packageJson.version);
    expect(program.commands.map((command) => command.name())).toEqual(
      expect.arrayContaining(["info", "audit", "report", "doctor", "sync", "prune"])
    );
  });

  it("prints foundation info without global installation", async () => {
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await runCli(["node", "hagi18n", "info"]);

    expect(stdout).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          packageName: packageJson.name,
          version: packageJson.version,
          status: "foundation"
        },
        null,
        2
      )}\n`
    );

    stdout.mockRestore();
  });

  it("supports audit, report, doctor, sync, and prune commands with config loading and exit codes", async () => {
    const project = await createTempProject("hagi18n-cli-commands-");
    await writeProjectFile(
      project.root,
      "hagi18n.yaml",
      `localesRoot: src/locales
repoRoot: .
baseLocale: en-US
targetLocales:
  - zh-CN
`
    );
    await writeLocaleFile(project.localesRoot, "en-US", "common.yml", 'title: "Hello"\n');
    await writeLocaleFile(project.localesRoot, "zh-CN", "common.yml", "extra: \"额外\"\n");
    await writeLocaleFile(project.localesRoot, "zh-CN", "extra.yml", 'value: "remove"\n');
    await writeProjectFile(project.root, "src/problem.ts", "i18n.changeLanguage('en')\n");

    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await withCwd(project.root, async () => {
      await runCli(["node", "hagi18n", "audit", "--config", "hagi18n.yaml"]);
      expect(process.exitCode).toBe(1);

      const auditJsonCallCount = stdout.mock.calls.length;
      await runCli(["node", "hagi18n", "report", "--config", "hagi18n.yaml"]);
      expect(process.exitCode).toBe(1);
      const reportOutput = stdout.mock.calls
        .slice(auditJsonCallCount)
        .map(([value]) => String(value))
        .join("");
      expect(JSON.parse(reportOutput)).toMatchObject({
        baseLocale: "en-US",
        locales: ["zh-CN"],
        hasIssues: true
      });

      await runCli(["node", "hagi18n", "doctor", "--config", "hagi18n.yaml"]);
      expect(process.exitCode).toBe(1);

      await runCli(["node", "hagi18n", "sync", "--config", "hagi18n.yaml"]);
      expect(process.exitCode).toBe(0);
      expect(await readProjectFile(project.root, "src/locales/zh-CN/common.yml")).toContain(
        'extra: "额外"'
      );

      await runCli([
        "node",
        "hagi18n",
        "sync",
        "--config",
        "hagi18n.yaml",
        "--write"
      ]);
      expect(process.exitCode).toBe(0);
      expect(await readProjectFile(project.root, "src/locales/zh-CN/common.yml")).toContain(
        "title: Hello"
      );

      await runCli([
        "node",
        "hagi18n",
        "prune",
        "--config",
        "hagi18n.yaml",
        "--write"
      ]);
      expect(process.exitCode).toBe(0);
      await expect(readProjectFile(project.root, "src/locales/zh-CN/extra.yml")).rejects.toThrow();
    });

    stdout.mockRestore();
  });

  it("recognizes npm bin symlinks as CLI entrypoints", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hagi18n-cli-"));
    const target = join(directory, "dist", "cli.js");
    const link = join(directory, "node_modules", ".bin", "hagi18n");

    await mkdir(join(directory, "dist"), { recursive: true });
    await mkdir(join(directory, "node_modules", ".bin"), { recursive: true });
    await writeFile(target, "");
    await symlink(target, link);

    expect(isCliEntrypoint(pathToFileURL(target).href, link)).toBe(true);
  });
});
