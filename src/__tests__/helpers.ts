import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface TempProject {
  root: string;
  localesRoot: string;
}

export async function createTempProject(prefix = "hagi18n-"): Promise<TempProject> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  return {
    root,
    localesRoot: path.join(root, "src", "locales")
  };
}

export async function writeProjectFile(
  root: string,
  relativePath: string,
  contents: string
): Promise<string> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
  return absolutePath;
}

export async function readProjectFile(
  root: string,
  relativePath: string
): Promise<string> {
  return readFile(path.join(root, relativePath), "utf8");
}

export async function writeLocaleFile(
  localesRoot: string,
  locale: string,
  relativePath: string,
  contents: string
): Promise<string> {
  const absolutePath = path.join(localesRoot, locale, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, "utf8");
  return absolutePath;
}

export async function withCwd<T>(cwd: string, callback: () => Promise<T>): Promise<T> {
  const previousCwd = process.cwd();
  process.chdir(cwd);

  try {
    return await callback();
  } finally {
    process.chdir(previousCwd);
  }
}
