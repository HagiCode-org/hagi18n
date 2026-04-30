import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import {
  DEFAULT_BASE_LOCALE,
  resolveHagi18nConfig,
  type ResolvedDoctorScanRule,
  type ResolveHagi18nConfigOptions
} from "./config.js";
import { normalizeLocaleName } from "./locale-name.js";

const PLACEHOLDER_PATTERN = /{{\s*[^}]+\s*}}/g;
const PROTECTED_TOKEN_PATTERN = /[\uE000\uE001]/u;

export interface YamlLocaleDocument {
  absolutePath: string;
  raw: string;
  data: Record<string, unknown>;
}

export interface LocaleParseError {
  file: string;
  message: string;
}

export interface LocaleMutationParseError extends LocaleParseError {
  locale: string;
}

export interface LocalePathIssue {
  file: string;
  path: string;
}

export interface LocalePlaceholderMismatch extends LocalePathIssue {
  expected: string[];
  actual: string[];
}

export interface AuditBaselineValueMatch extends LocalePathIssue {
  baselineLocales: string[];
  value: string;
}

export interface AuditLocaleResult {
  locale: string;
  missingFiles: string[];
  extraFiles: string[];
  filesWithProtectedTokens: string[];
  parseErrors: LocaleParseError[];
  missingKeys: LocalePathIssue[];
  extraKeys: LocalePathIssue[];
  placeholderMismatches: LocalePlaceholderMismatch[];
  baselineValueMatches: AuditBaselineValueMatch[];
}

export interface AuditLocaleTreeSummary {
  localesRoot: string;
  baseLocale: string;
  baselineLocales: string[];
  locales: string[];
  allLocales: string[];
  baseFileCount: number;
  results: AuditLocaleResult[];
  hasIssues: boolean;
}

export interface MutationChangedFile {
  locale: string;
  file: string;
  action: "create" | "update";
  addedPaths?: string[];
  removedPaths?: string[];
}

export interface MutationRemovedFile {
  locale: string;
  file: string;
  action: "remove-file";
}

export interface MutationTotals {
  createdFiles: number;
  updatedFiles: number;
  removedFiles: number;
  addedPaths: number;
  removedPaths: number;
}

export interface MutationSummary {
  command: "sync" | "prune";
  localesRoot: string;
  baseLocale: string;
  targetLocales: string[];
  dryRun: boolean;
  changedFiles: MutationChangedFile[];
  removedFiles: MutationRemovedFile[];
  parseErrors: LocaleMutationParseError[];
  totals: MutationTotals;
  hasIssues: boolean;
}

export interface DoctorRuleIssue {
  ruleId: string;
  file: string;
  line: number;
  message: string;
  snippet: string;
}

export interface DoctorLocaleTreeSummary {
  repoRoot: string;
  localesRoot: string;
  baseLocale: string;
  baselineLocales: string[];
  locales: string[];
  audit: AuditLocaleTreeSummary;
  legacyReferenceIssues: DoctorRuleIssue[];
  totals: {
    legacyReferenceIssues: number;
    affectedFiles: number;
  };
  hasIssues: boolean;
}

export interface LocaleToolkitOptions extends ResolveHagi18nConfigOptions {}

export interface MutationLocaleToolkitOptions extends LocaleToolkitOptions {
  dryRun?: boolean;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function compareValues(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function resolveExistingLocale(
  locales: string[],
  requestedLocale: unknown
): string | null {
  const normalizedRequestedLocale = normalizeLocaleName(requestedLocale);
  if (!normalizedRequestedLocale) {
    return null;
  }

  const exactMatch = locales.find((locale) => locale === normalizedRequestedLocale);
  if (exactMatch) {
    return exactMatch;
  }

  return (
    locales.find(
      (locale) => locale.toLowerCase() === normalizedRequestedLocale.toLowerCase()
    ) ?? null
  );
}

function resolveTargetLocales(
  locales: string[],
  excludedLocales: readonly string[],
  targetLocales?: string[] | null,
  {
    allowExcludedExplicitly = false,
    excludeExcludedByDefault = true
  }: {
    allowExcludedExplicitly?: boolean;
    excludeExcludedByDefault?: boolean;
  } = {}
): string[] {
  const excludedLocaleSet = new Set(excludedLocales);

  if (!targetLocales || targetLocales.length === 0) {
    const defaultTargets = excludeExcludedByDefault
      ? locales.filter((locale) => !excludedLocaleSet.has(locale))
      : [...locales];

    if (defaultTargets.length === 0 && excludeExcludedByDefault) {
      throw new Error(
        `No non-baseline target locales remain after excluding baseline locales: ${[...excludedLocaleSet].join(", ")}`
      );
    }

    return defaultTargets;
  }

  const resolvedTargets: string[] = [];
  for (const targetLocale of targetLocales) {
    const resolvedLocale = resolveExistingLocale(locales, targetLocale);
    if (!resolvedLocale) {
      throw new Error(
        `Target locale '${targetLocale}' was not found. Available locales: ${locales.join(", ")}`
      );
    }

    if (!allowExcludedExplicitly && excludedLocaleSet.has(resolvedLocale)) {
      continue;
    }

    if (!resolvedTargets.includes(resolvedLocale)) {
      resolvedTargets.push(resolvedLocale);
    }
  }

  return resolvedTargets;
}

function isDoctorRuleAllowed(
  allowlist: Record<string, string[]>,
  ruleId: string,
  relativePath: string
): boolean {
  return allowlist[ruleId]?.includes(relativePath) ?? false;
}

export async function listLocaleDirectories(localesRoot: string): Promise<string[]> {
  const entries = await fs.readdir(localesRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function walkYamlFiles(
  directory: string,
  prefix = ""
): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkYamlFiles(absolutePath, relativePath)));
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))) {
      files.push(relativePath);
    }
  }

  return files;
}

export async function readYamlLocaleFile(
  localesRoot: string,
  locale: string,
  relativeFilePath: string
): Promise<YamlLocaleDocument> {
  const absolutePath = path.join(localesRoot, locale, relativeFilePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const parsed = yaml.load(raw);

  if (parsed === undefined) {
    return {
      absolutePath,
      raw,
      data: {}
    };
  }

  if (!isPlainObject(parsed)) {
    throw new Error(
      `Top-level YAML document must be a mapping object: ${relativeFilePath}`
    );
  }

  return {
    absolutePath,
    raw,
    data: parsed
  };
}

export function collectScalarPaths(
  value: unknown,
  prefix: string[] = [],
  output: string[] = []
): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectScalarPaths(item, [...prefix, String(index)], output)
    );
    return output;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectScalarPaths(child, [...prefix, key], output);
    }
    return output;
  }

  output.push(prefix.join("."));
  return output;
}

export function collectPlaceholders(
  value: unknown,
  prefix: string[] = [],
  output = new Map<string, string[]>()
): Map<string, string[]> {
  if (typeof value === "string") {
    const key = prefix.join(".");
    const matches = [...value.matchAll(PLACEHOLDER_PATTERN)]
      .map((match) => match[0])
      .sort((left, right) => left.localeCompare(right));
    output.set(key, matches);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectPlaceholders(item, [...prefix, String(index)], output)
    );
    return output;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectPlaceholders(child, [...prefix, key], output);
    }
  }

  return output;
}

export function difference(source: string[], other: string[]): string[] {
  const otherSet = new Set(other);
  return source.filter((item) => !otherSet.has(item));
}

export function collectPlaceholderDifferences(
  basePlaceholders: Map<string, string[]>,
  currentPlaceholders: Map<string, string[]>
): Array<Omit<LocalePlaceholderMismatch, "file">> {
  const differences: Array<Omit<LocalePlaceholderMismatch, "file">> = [];

  for (const [pathKey, expectedPlaceholders] of basePlaceholders.entries()) {
    const actualPlaceholders = currentPlaceholders.get(pathKey) ?? [];
    if (expectedPlaceholders.length !== actualPlaceholders.length) {
      differences.push({
        path: pathKey,
        expected: expectedPlaceholders,
        actual: actualPlaceholders
      });
      continue;
    }

    const isSame = expectedPlaceholders.every(
      (placeholder, index) => placeholder === actualPlaceholders[index]
    );
    if (!isSame) {
      differences.push({
        path: pathKey,
        expected: expectedPlaceholders,
        actual: actualPlaceholders
      });
    }
  }

  return differences;
}

export function createAuditResult(locale: string): AuditLocaleResult {
  return {
    locale,
    missingFiles: [],
    extraFiles: [],
    filesWithProtectedTokens: [],
    parseErrors: [],
    missingKeys: [],
    extraKeys: [],
    placeholderMismatches: [],
    baselineValueMatches: []
  };
}

export function auditHasIssues(result: AuditLocaleResult): boolean {
  return (
    result.missingFiles.length > 0 ||
    result.extraFiles.length > 0 ||
    result.filesWithProtectedTokens.length > 0 ||
    result.parseErrors.length > 0 ||
    result.missingKeys.length > 0 ||
    result.extraKeys.length > 0 ||
    result.placeholderMismatches.length > 0 ||
    result.baselineValueMatches.length > 0
  );
}

function collectStringScalars(
  value: unknown,
  prefix: string[] = [],
  output = new Map<string, string>()
): Map<string, string> {
  if (typeof value === "string") {
    output.set(prefix.join("."), value);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectStringScalars(item, [...prefix, String(index)], output)
    );
    return output;
  }

  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectStringScalars(child, [...prefix, key], output);
    }
  }

  return output;
}

function collectBaselineValueMatches(
  targetData: Record<string, unknown>,
  baselineDocuments: Map<string, YamlLocaleDocument>,
  relativeFilePath: string
): AuditBaselineValueMatch[] {
  const targetStrings = collectStringScalars(targetData);
  const baselineStrings = [...baselineDocuments.entries()].map(([locale, document]) => ({
    locale,
    values: collectStringScalars(document.data)
  }));
  const matches: AuditBaselineValueMatch[] = [];

  for (const [pathKey, value] of targetStrings.entries()) {
    const matchedBaselineLocales = baselineStrings
      .filter((baseline) => baseline.values.get(pathKey) === value)
      .map((baseline) => baseline.locale);

    if (matchedBaselineLocales.length === 0) {
      continue;
    }

    matches.push({
      file: relativeFilePath,
      path: pathKey,
      baselineLocales: matchedBaselineLocales,
      value
    });
  }

  return matches;
}

function resolveBaselineLocales(
  locales: string[],
  requestedBaselineLocales: readonly string[]
): string[] {
  const resolvedBaselineLocales: string[] = [];

  for (const requestedBaselineLocale of requestedBaselineLocales) {
    const resolvedBaselineLocale = resolveExistingLocale(locales, requestedBaselineLocale);
    if (!resolvedBaselineLocale) {
      throw new Error(
        `Base locale '${requestedBaselineLocale}' was not found. Available locales: ${locales.join(", ")}`
      );
    }

    if (!resolvedBaselineLocales.includes(resolvedBaselineLocale)) {
      resolvedBaselineLocales.push(resolvedBaselineLocale);
    }
  }

  return resolvedBaselineLocales;
}

async function resolveAuditInputs(options: LocaleToolkitOptions) {
  const resolvedConfig = await resolveHagi18nConfig(options);
  const locales = await listLocaleDirectories(resolvedConfig.localesRoot);
  if (locales.length === 0) {
    throw new Error(
      `No locale directories found under ${resolvedConfig.localesRoot}`
    );
  }

  const requestedBaselineLocales =
    options.auditBaseLocales && options.auditBaseLocales.length > 0
      ? options.auditBaseLocales
      : options.baseLocale
        ? [options.baseLocale]
        : resolvedConfig.auditBaseLocales.length > 0
          ? resolvedConfig.auditBaseLocales
          : [resolvedConfig.baseLocale ?? DEFAULT_BASE_LOCALE];
  const resolvedBaselineLocales = resolveBaselineLocales(
    locales,
    requestedBaselineLocales
  );
  const resolvedBaseLocale = resolvedBaselineLocales[0];

  const selectedLocales = resolveTargetLocales(
    locales,
    resolvedBaselineLocales,
    options.targetLocales ?? resolvedConfig.targetLocales,
    {
      allowExcludedExplicitly: false,
      excludeExcludedByDefault: true
    }
  );
  if (selectedLocales.length === 0) {
    throw new Error(
      `No non-baseline target locales remain after excluding baseline locales: ${resolvedBaselineLocales.join(", ")}`
    );
  }

  return {
    config: resolvedConfig,
    locales,
    resolvedBaseLocale,
    resolvedBaselineLocales,
    selectedLocales
  };
}

export async function auditLocaleTree(
  options: LocaleToolkitOptions = {}
): Promise<AuditLocaleTreeSummary> {
  const {
    config,
    locales,
    resolvedBaseLocale,
    resolvedBaselineLocales,
    selectedLocales
  } =
    await resolveAuditInputs(options);
  const baseFiles = await walkYamlFiles(
    path.join(config.localesRoot, resolvedBaseLocale)
  );
  const results: AuditLocaleResult[] = [];

  for (const locale of selectedLocales) {
    const result = createAuditResult(locale);
    const localeDirectory = path.join(config.localesRoot, locale);
    const localeFiles = await walkYamlFiles(localeDirectory);

    result.missingFiles = difference(baseFiles, localeFiles);
    result.extraFiles = difference(localeFiles, baseFiles);

    const comparableFiles = baseFiles.filter((file) => localeFiles.includes(file));
    for (const relativeFilePath of comparableFiles) {
      try {
        const baseDocument = await readYamlLocaleFile(
          config.localesRoot,
          resolvedBaseLocale,
          relativeFilePath
        );
        const currentDocument = await readYamlLocaleFile(
          config.localesRoot,
          locale,
          relativeFilePath
        );
        const baselineDocuments = new Map<string, YamlLocaleDocument>();
        for (const baselineLocale of resolvedBaselineLocales) {
          try {
            const baselineDocument = await readYamlLocaleFile(
              config.localesRoot,
              baselineLocale,
              relativeFilePath
            );
            baselineDocuments.set(baselineLocale, baselineDocument);
          } catch (error) {
            if (
              (error &&
                typeof error === "object" &&
                "code" in error &&
                error.code === "ENOENT") ||
              String(error).includes("ENOENT")
            ) {
              continue;
            }

            throw error;
          }
        }

        if (PROTECTED_TOKEN_PATTERN.test(currentDocument.raw)) {
          result.filesWithProtectedTokens.push(relativeFilePath);
        }

        const baseScalarPaths = collectScalarPaths(baseDocument.data).sort((left, right) =>
          left.localeCompare(right)
        );
        const currentScalarPaths = collectScalarPaths(currentDocument.data).sort(
          (left, right) => left.localeCompare(right)
        );

        for (const missingPath of difference(baseScalarPaths, currentScalarPaths)) {
          result.missingKeys.push({ file: relativeFilePath, path: missingPath });
        }

        for (const extraPath of difference(currentScalarPaths, baseScalarPaths)) {
          result.extraKeys.push({ file: relativeFilePath, path: extraPath });
        }

        const placeholderDifferences = collectPlaceholderDifferences(
          collectPlaceholders(baseDocument.data),
          collectPlaceholders(currentDocument.data)
        );

        for (const differenceItem of placeholderDifferences) {
          result.placeholderMismatches.push({
            file: relativeFilePath,
            ...differenceItem
          });
        }

        result.baselineValueMatches.push(
          ...collectBaselineValueMatches(
            currentDocument.data,
            baselineDocuments,
            relativeFilePath
          )
        );
      } catch (error) {
        result.parseErrors.push({
          file: relativeFilePath,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    results.push(result);
  }

  return {
    localesRoot: config.localesRoot,
    baseLocale: resolvedBaseLocale,
    baselineLocales: resolvedBaselineLocales,
    locales: selectedLocales,
    allLocales: locales,
    baseFileCount: baseFiles.length,
    results,
    hasIssues: results.some(auditHasIssues)
  };
}

function syncNode(
  baseValue: unknown,
  targetValue: unknown,
  pathSegments: string[] = [],
  addedPaths: string[] = []
): unknown {
  if (Array.isArray(baseValue)) {
    if (!Array.isArray(targetValue)) {
      addedPaths.push(pathSegments.join("."));
      return cloneValue(baseValue);
    }

    const result: unknown[] = [];
    for (let index = 0; index < baseValue.length; index += 1) {
      const childPath = [...pathSegments, String(index)];
      if (index < targetValue.length) {
        result[index] = syncNode(baseValue[index], targetValue[index], childPath, addedPaths);
      } else {
        addedPaths.push(childPath.join("."));
        result[index] = cloneValue(baseValue[index]);
      }
    }

    for (let index = baseValue.length; index < targetValue.length; index += 1) {
      result[index] = cloneValue(targetValue[index]);
    }

    return result;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(targetValue)) {
      addedPaths.push(pathSegments.join("."));
      return cloneValue(baseValue);
    }

    const result: Record<string, unknown> = {};
    for (const [key, childBaseValue] of Object.entries(baseValue)) {
      const childPath = [...pathSegments, key];
      if (Object.hasOwn(targetValue, key)) {
        result[key] = syncNode(
          childBaseValue,
          targetValue[key],
          childPath,
          addedPaths
        );
      } else {
        addedPaths.push(childPath.join("."));
        result[key] = cloneValue(childBaseValue);
      }
    }

    for (const [key, childTargetValue] of Object.entries(targetValue)) {
      if (!Object.hasOwn(baseValue, key)) {
        result[key] = cloneValue(childTargetValue);
      }
    }

    return result;
  }

  return targetValue === undefined ? cloneValue(baseValue) : cloneValue(targetValue);
}

function pruneNode(
  baseValue: unknown,
  targetValue: unknown,
  pathSegments: string[] = [],
  removedPaths: string[] = []
): unknown {
  if (Array.isArray(baseValue)) {
    if (!Array.isArray(targetValue)) {
      return cloneValue(targetValue);
    }

    const result: unknown[] = [];
    const sharedLength = Math.min(baseValue.length, targetValue.length);
    for (let index = 0; index < sharedLength; index += 1) {
      result[index] = pruneNode(
        baseValue[index],
        targetValue[index],
        [...pathSegments, String(index)],
        removedPaths
      );
    }

    for (let index = sharedLength; index < targetValue.length; index += 1) {
      removedPaths.push([...pathSegments, String(index)].join("."));
    }

    return result;
  }

  if (isPlainObject(baseValue)) {
    if (!isPlainObject(targetValue)) {
      return cloneValue(targetValue);
    }

    const result: Record<string, unknown> = {};
    for (const [key, childTargetValue] of Object.entries(targetValue)) {
      const childPath = [...pathSegments, key];
      if (Object.hasOwn(baseValue, key)) {
        result[key] = pruneNode(
          baseValue[key],
          childTargetValue,
          childPath,
          removedPaths
        );
      } else {
        removedPaths.push(childPath.join("."));
      }
    }

    return result;
  }

  return cloneValue(targetValue);
}

function dumpYamlDocument(value: unknown): string {
  return `${yaml.dump(value, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  })}`;
}

async function writeYamlLocaleFile(absolutePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, dumpYamlDocument(value), "utf8");
}

function createMutationSummary(
  command: MutationSummary["command"],
  localesRoot: string,
  baseLocale: string,
  targetLocales: string[],
  dryRun: boolean
): MutationSummary {
  return {
    command,
    localesRoot,
    baseLocale,
    targetLocales,
    dryRun,
    changedFiles: [],
    removedFiles: [],
    parseErrors: [],
    totals: {
      createdFiles: 0,
      updatedFiles: 0,
      removedFiles: 0,
      addedPaths: 0,
      removedPaths: 0
    },
    hasIssues: false
  };
}

async function resolveMutationInputs(
  options: MutationLocaleToolkitOptions,
  command: MutationSummary["command"]
) {
  const config = await resolveHagi18nConfig(options);
  const locales = await listLocaleDirectories(config.localesRoot);
  const resolvedBaseLocale = resolveExistingLocale(
    locales,
    options.baseLocale ?? config.baseLocale
  );

  if (!resolvedBaseLocale) {
    throw new Error(
      `Base locale '${options.baseLocale ?? config.baseLocale}' was not found. Available locales: ${locales.join(", ")}`
    );
  }

  const resolvedTargets = resolveTargetLocales(
    locales,
    [resolvedBaseLocale],
    options.targetLocales ?? config.targetLocales
  );

  return {
    config,
    resolvedBaseLocale,
    resolvedTargets,
    summary: createMutationSummary(
      command,
      config.localesRoot,
      resolvedBaseLocale,
      resolvedTargets,
      options.dryRun ?? true
    )
  };
}

export async function syncLocaleTree(
  options: MutationLocaleToolkitOptions = {}
): Promise<MutationSummary> {
  const { config, resolvedBaseLocale, resolvedTargets, summary } =
    await resolveMutationInputs(options, "sync");
  const baseFiles = await walkYamlFiles(
    path.join(config.localesRoot, resolvedBaseLocale)
  );

  for (const locale of resolvedTargets) {
    for (const relativeFilePath of baseFiles) {
      const absoluteTargetPath = path.join(config.localesRoot, locale, relativeFilePath);

      try {
        const baseDocument = await readYamlLocaleFile(
          config.localesRoot,
          resolvedBaseLocale,
          relativeFilePath
        );
        let targetDocument: YamlLocaleDocument | null = null;

        try {
          targetDocument = await readYamlLocaleFile(
            config.localesRoot,
            locale,
            relativeFilePath
          );
        } catch (error) {
          if (
            (error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "ENOENT") ||
            String(error).includes("ENOENT")
          ) {
            targetDocument = null;
          } else {
            throw error;
          }
        }

        if (!targetDocument) {
          summary.changedFiles.push({
            locale,
            file: relativeFilePath,
            action: "create",
            addedPaths: ["<entire-file>"]
          });
          summary.totals.createdFiles += 1;
          summary.totals.addedPaths += 1;

          if (!summary.dryRun) {
            await writeYamlLocaleFile(absoluteTargetPath, baseDocument.data);
          }
          continue;
        }

        const addedPaths: string[] = [];
        const merged = syncNode(baseDocument.data, targetDocument.data, [], addedPaths);
        if (addedPaths.length === 0 || compareValues(merged, targetDocument.data)) {
          continue;
        }

        summary.changedFiles.push({
          locale,
          file: relativeFilePath,
          action: "update",
          addedPaths
        });
        summary.totals.updatedFiles += 1;
        summary.totals.addedPaths += addedPaths.length;

        if (!summary.dryRun) {
          await writeYamlLocaleFile(absoluteTargetPath, merged);
        }
      } catch (error) {
        summary.parseErrors.push({
          locale,
          file: relativeFilePath,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  summary.hasIssues = summary.parseErrors.length > 0;
  return summary;
}

export async function pruneLocaleTree(
  options: MutationLocaleToolkitOptions = {}
): Promise<MutationSummary> {
  const { config, resolvedBaseLocale, resolvedTargets, summary } =
    await resolveMutationInputs(options, "prune");
  const baseFiles = await walkYamlFiles(
    path.join(config.localesRoot, resolvedBaseLocale)
  );

  for (const locale of resolvedTargets) {
    const localeRoot = path.join(config.localesRoot, locale);
    const localeFiles = await walkYamlFiles(localeRoot);
    const extraFiles = difference(localeFiles, baseFiles);

    for (const relativeFilePath of extraFiles) {
      summary.removedFiles.push({
        locale,
        file: relativeFilePath,
        action: "remove-file"
      });
      summary.totals.removedFiles += 1;

      if (!summary.dryRun) {
        await fs.rm(path.join(localeRoot, relativeFilePath), { force: true });
      }
    }

    const comparableFiles = baseFiles.filter((file) => localeFiles.includes(file));
    for (const relativeFilePath of comparableFiles) {
      try {
        const baseDocument = await readYamlLocaleFile(
          config.localesRoot,
          resolvedBaseLocale,
          relativeFilePath
        );
        const targetDocument = await readYamlLocaleFile(
          config.localesRoot,
          locale,
          relativeFilePath
        );
        const removedPaths: string[] = [];
        const pruned = pruneNode(baseDocument.data, targetDocument.data, [], removedPaths);

        if (removedPaths.length === 0 || compareValues(pruned, targetDocument.data)) {
          continue;
        }

        summary.changedFiles.push({
          locale,
          file: relativeFilePath,
          action: "update",
          removedPaths
        });
        summary.totals.updatedFiles += 1;
        summary.totals.removedPaths += removedPaths.length;

        if (!summary.dryRun) {
          await writeYamlLocaleFile(
            path.join(config.localesRoot, locale, relativeFilePath),
            pruned
          );
        }
      } catch (error) {
        summary.parseErrors.push({
          locale,
          file: relativeFilePath,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  summary.hasIssues = summary.parseErrors.length > 0;
  return summary;
}

async function walkRepositoryFiles(
  rootDirectory: string,
  excludedDirectories: Set<string>,
  textExtensions: Set<string>,
  excludedPathPrefixes: string[],
  prefix = ""
): Promise<string[]> {
  const entries = await fs.readdir(rootDirectory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    const absolutePath = path.join(rootDirectory, entry.name);

    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) {
        continue;
      }

      files.push(
        ...(await walkRepositoryFiles(
          absolutePath,
          excludedDirectories,
          textExtensions,
          excludedPathPrefixes,
          relativePath
        ))
      );
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (excludedPathPrefixes.some((pathPrefix) => relativePath.startsWith(pathPrefix))) {
      continue;
    }

    if (textExtensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }

  return files;
}

async function scanRepositoryForLegacyLocaleReferences(
  repoRoot: string,
  scanRules: ResolvedDoctorScanRule[],
  allowlist: Record<string, string[]>,
  excludedDirectories: string[],
  textFileExtensions: string[],
  excludedPathPrefixes: string[]
): Promise<DoctorRuleIssue[]> {
  const files = await walkRepositoryFiles(
    repoRoot,
    new Set(excludedDirectories),
    new Set(textFileExtensions),
    excludedPathPrefixes
  );
  const issues: DoctorRuleIssue[] = [];

  for (const relativePath of files) {
    const absolutePath = path.join(repoRoot, relativePath);
    const sourceText = await fs.readFile(absolutePath, "utf8");
    const lines = sourceText.split(/\r?\n/u);

    lines.forEach((line, index) => {
      for (const rule of scanRules) {
        rule.regex.lastIndex = 0;
        if (!rule.regex.test(line) || isDoctorRuleAllowed(allowlist, rule.id, relativePath)) {
          continue;
        }

        issues.push({
          ruleId: rule.id,
          file: relativePath,
          line: index + 1,
          message: rule.message,
          snippet: line.trim()
        });
      }
    });
  }

  return issues;
}

export async function doctorLocaleTree(
  options: LocaleToolkitOptions = {}
): Promise<DoctorLocaleTreeSummary> {
  const config = await resolveHagi18nConfig(options);
  const audit = await auditLocaleTree(options);
  const legacyReferenceIssues = await scanRepositoryForLegacyLocaleReferences(
    config.repoRoot,
    config.doctor.scanRules,
    config.doctor.allowlist,
    config.doctor.excludedDirectories,
    config.doctor.textFileExtensions,
    config.doctor.excludedPathPrefixes
  );
  const affectedFiles = [...new Set(legacyReferenceIssues.map((issue) => issue.file))].sort(
    (left, right) => left.localeCompare(right)
  );

  return {
    repoRoot: config.repoRoot,
    localesRoot: config.localesRoot,
    baseLocale: audit.baseLocale,
    baselineLocales: audit.baselineLocales,
    locales: audit.locales,
    audit,
    legacyReferenceIssues,
    totals: {
      legacyReferenceIssues: legacyReferenceIssues.length,
      affectedFiles: affectedFiles.length
    },
    hasIssues: audit.hasIssues || legacyReferenceIssues.length > 0
  };
}

function formatListSection<T>(
  title: string,
  items: T[],
  formatter: (item: T) => string = (item) => String(item)
): string[] {
  if (items.length === 0) {
    return [];
  }

  return [
    `  ${title}: ${items.length}`,
    ...items.slice(0, 20).map((item) => `    - ${formatter(item)}`),
    ...(items.length > 20 ? [`    - ...and ${items.length - 20} more`] : [])
  ];
}

export function formatAuditSummary(summary: AuditLocaleTreeSummary): string {
  const lines = [
    `Base locale: ${summary.baseLocale}`,
    `Baseline locales: ${summary.baselineLocales.join(", ")}`,
    `Locales: ${summary.locales.join(", ")}`,
    `Files audited from base locale: ${summary.baseFileCount}`,
    ""
  ];

  for (const result of summary.results) {
    lines.push(`${result.locale}: ${auditHasIssues(result) ? "issues found" : "ok"}`);
    const sections = [
      ...formatListSection("Missing files", result.missingFiles),
      ...formatListSection("Extra files", result.extraFiles),
      ...formatListSection("Protected token files", result.filesWithProtectedTokens),
      ...formatListSection("Parse errors", result.parseErrors, (item) => `${item.file}: ${item.message}`),
      ...formatListSection("Missing keys", result.missingKeys, (item) => `${item.file} -> ${item.path}`),
      ...formatListSection("Extra keys", result.extraKeys, (item) => `${item.file} -> ${item.path}`),
      ...formatListSection("Placeholder mismatches", result.placeholderMismatches, (item) =>
        `${item.file} -> ${item.path} | expected ${JSON.stringify(item.expected)} | actual ${JSON.stringify(item.actual)}`
      ),
      ...formatListSection("Baseline value matches", result.baselineValueMatches, (item) =>
        `${item.file} -> ${item.path} | matches [${item.baselineLocales.join(", ")}] | value ${JSON.stringify(item.value)}`
      )
    ];

    if (sections.length === 0) {
      lines.push("  No issues.");
    } else {
      lines.push(...sections);
    }

    lines.push("");
  }

  const localesWithIssues = summary.results
    .filter(auditHasIssues)
    .map((result) => result.locale);
  if (localesWithIssues.length === 0) {
    lines.push("Locale audit passed.");
  } else {
    lines.push(`Locale audit failed for: ${localesWithIssues.join(", ")}`);
  }

  return lines.join("\n");
}

export function formatMutationSummary(summary: MutationSummary): string {
  const lines = [
    `Command: ${summary.command}`,
    `Base locale: ${summary.baseLocale}`,
    `Target locales: ${summary.targetLocales.join(", ") || "(none)"}`,
    `Mode: ${summary.dryRun ? "dry-run" : "write"}`,
    ""
  ];

  if (
    summary.changedFiles.length === 0 &&
    summary.removedFiles.length === 0 &&
    summary.parseErrors.length === 0
  ) {
    lines.push("No changes.");
  } else {
    lines.push(
      ...formatListSection("Changed files", summary.changedFiles, (item) => {
        if (item.action === "create") {
          return `${item.locale}/${item.file} -> create`;
        }

        const details = item.addedPaths
          ? `added ${item.addedPaths.length} path(s)`
          : `removed ${item.removedPaths?.length ?? 0} path(s)`;
        return `${item.locale}/${item.file} -> ${details}`;
      })
    );
    lines.push(
      ...formatListSection("Removed files", summary.removedFiles, (item) => `${item.locale}/${item.file}`)
    );
    lines.push(
      ...formatListSection(
        "Parse errors",
        summary.parseErrors,
        (item) => `${item.locale}/${item.file}: ${item.message}`
      )
    );
  }

  lines.push("");
  lines.push(
    `Totals: createdFiles=${summary.totals.createdFiles}, updatedFiles=${summary.totals.updatedFiles}, removedFiles=${summary.totals.removedFiles}, addedPaths=${summary.totals.addedPaths}, removedPaths=${summary.totals.removedPaths}`
  );

  return lines.join("\n");
}

export function formatDoctorSummary(summary: DoctorLocaleTreeSummary): string {
  const lines = [
    `Base locale: ${summary.baseLocale}`,
    `Baseline locales: ${summary.baselineLocales.join(", ")}`,
    `Locales: ${summary.locales.join(", ")}`,
    `Legacy reference issues: ${summary.totals.legacyReferenceIssues}`,
    `Affected files: ${summary.totals.affectedFiles}`,
    "",
    formatAuditSummary(summary.audit)
  ];

  if (summary.legacyReferenceIssues.length === 0) {
    lines.push("");
    lines.push("Legacy locale reference scan passed.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Legacy locale references:");
  for (const issue of summary.legacyReferenceIssues.slice(0, 50)) {
    lines.push(
      `  - ${issue.file}:${issue.line} [${issue.ruleId}] ${issue.message}`
    );
    lines.push(`    ${issue.snippet}`);
  }

  if (summary.legacyReferenceIssues.length > 50) {
    lines.push(`  - ...and ${summary.legacyReferenceIssues.length - 50} more`);
  }

  return lines.join("\n");
}
