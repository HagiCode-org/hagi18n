import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createCli, isCliEntrypoint, runCli } from "../cli.js";

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
    expect(program.helpInformation()).toContain(
      "Hagi18n localization tooling CLI foundation."
    );
    expect(program.version()).toBe(packageJson.version);
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
