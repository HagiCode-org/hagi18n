import { access, readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { normalizeLocaleName } from "./locale-name.js";

export const DEFAULT_BASE_LOCALE = "en-US";
export const DEFAULT_CONFIG_FILE_NAMES = ["hagi18n.yaml", "hagi18n.yml"] as const;
export const DEFAULT_DOCTOR_EXCLUDED_DIRECTORIES = [
  ".git",
  "coverage",
  "dist",
  "indexGenerator",
  "node_modules",
  "public"
] as const;
export const DEFAULT_DOCTOR_TEXT_FILE_EXTENSIONS = [
  ".cjs",
  ".js",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx"
] as const;
export const DEFAULT_DOCTOR_EXCLUDED_PATH_PREFIXES = ["src/generated/"] as const;

export interface DoctorScanRuleConfig {
  id: string;
  message: string;
  pattern: string;
  flags?: string;
}

export interface Hagi18nDoctorConfig {
  excludedDirectories?: string[];
  textFileExtensions?: string[];
  excludedPathPrefixes?: string[];
  allowlist?: Record<string, string[]>;
  scanRules?: DoctorScanRuleConfig[];
}

export interface Hagi18nConfig {
  localesRoot?: string;
  repoRoot?: string;
  baseLocale?: string;
  auditBaseLocales?: string[];
  targetLocales?: string[];
  doctor?: Hagi18nDoctorConfig;
}

export interface ResolvedDoctorScanRule extends DoctorScanRuleConfig {
  regex: RegExp;
}

export interface ResolvedHagi18nDoctorConfig {
  excludedDirectories: string[];
  textFileExtensions: string[];
  excludedPathPrefixes: string[];
  allowlist: Record<string, string[]>;
  scanRules: ResolvedDoctorScanRule[];
}

export interface ResolvedHagi18nConfig {
  cwd: string;
  configPath: string | null;
  localesRoot: string;
  repoRoot: string;
  baseLocale: string;
  auditBaseLocales: string[];
  targetLocales: string[];
  doctor: ResolvedHagi18nDoctorConfig;
}

export interface LoadHagi18nConfigOptions {
  cwd?: string;
  configPath?: string | null;
}

export interface LoadHagi18nConfigResult {
  cwd: string;
  configPath: string | null;
  config: Hagi18nConfig | null;
}

export interface ResolveHagi18nConfigOptions
  extends LoadHagi18nConfigOptions,
    Hagi18nConfig {}

interface ResolvedConfigLayer
  extends Partial<Omit<ResolvedHagi18nConfig, "doctor">> {
  doctor?: Partial<ResolvedHagi18nDoctorConfig>;
}

export const DEFAULT_DOCTOR_SCAN_RULES: DoctorScanRuleConfig[] = [
  {
    id: "legacy-locale-path",
    message: "Legacy locale paths should use en-US instead of en.",
    pattern: "(?:src\\/locales\\/en\\/|\\.\\.\\/\\.\\.\\/locales\\/en\\/)"
  },
  {
    id: "legacy-language-change-call",
    message: "Use en-US when switching the canonical UI language in code or tests.",
    pattern: "\\b(?:i18n\\.)?changeLanguage\\(\\s*['\"]en['\"]\\s*\\)"
  },
  {
    id: "legacy-ui-language-literal",
    message: "Use en-US as the canonical UI language literal.",
    pattern:
      "\\b(currentLanguage|confirmedLanguage|detectedLanguage|resolvedLanguage|language|lng)\\s*[:=]\\s*['\"]en['\"]"
  },
  {
    id: "legacy-ui-language-union",
    message: "Use en-US in UI-language unions and casts.",
    pattern: "(?:as\\s+)?['\"]en['\"]\\s*\\|\\s*['\"]zh-CN['\"]"
  }
];

export const DEFAULT_DOCTOR_ALLOWLIST: Record<string, string[]> = {
  "legacy-ui-language-literal": [
    "src/services/__tests__/frontendConfigBootstrap.generalSettings.test.ts",
    "src/services/__tests__/frontendConfigBootstrap.projectScope.test.ts",
    "src/store/__tests__/aiLanguageSlice.test.ts",
    "src/store/listeners/__tests__/frontendConfigSyncListener.projectScope.test.ts",
    "src/store/slices/__tests__/generalSettingsSlice.test.ts"
  ],
  "legacy-language-change-call": [],
  "legacy-locale-path": [],
  "legacy-ui-language-union": []
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ensureString(
  value: unknown,
  fieldName: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {}
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    throw new Error(`${fieldName} must not be empty.`);
  }

  return trimmed;
}

function ensureStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }

  return value.map((entry, index) => {
    const validated = ensureString(entry, `${fieldName}[${index}]`);
    return validated ?? "";
  });
}

function dedupeStrings(values: readonly string[]): string[] {
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || output.includes(trimmed)) {
      continue;
    }

    output.push(trimmed);
  }

  return output;
}

function normalizeLocaleValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeLocaleName(value) ?? value.trim();
}

function normalizeLocaleValues(values: readonly string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }

  const output: string[] = [];
  for (const value of values) {
    const normalizedValue = normalizeLocaleName(value) ?? value.trim();
    if (!normalizedValue || output.includes(normalizedValue)) {
      continue;
    }

    output.push(normalizedValue);
  }

  return output;
}

function normalizeAllowlist(
  value: unknown,
  fieldName: string
): Record<string, string[]> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be a mapping of rule ids to file paths.`);
  }

  const output: Record<string, string[]> = {};
  for (const [ruleId, paths] of Object.entries(value)) {
    output[ruleId] = dedupeStrings(
      ensureStringArray(paths, `${fieldName}.${ruleId}`) ?? []
    );
  }

  return output;
}

function normalizeScanRules(
  value: unknown,
  fieldName: string
): DoctorScanRuleConfig[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of rule definitions.`);
  }

  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`${fieldName}[${index}] must be a mapping.`);
    }

    return {
      id: ensureString(entry.id, `${fieldName}[${index}].id`) ?? "",
      message:
        ensureString(entry.message, `${fieldName}[${index}].message`) ?? "",
      pattern:
        ensureString(entry.pattern, `${fieldName}[${index}].pattern`) ?? "",
      flags: ensureString(entry.flags, `${fieldName}[${index}].flags`, {
        allowEmpty: true
      })
    };
  });
}

function parseDoctorConfig(value: unknown): Hagi18nDoctorConfig | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isPlainObject(value)) {
    throw new Error("doctor must be a mapping.");
  }

  return {
    excludedDirectories: ensureStringArray(
      value.excludedDirectories,
      "doctor.excludedDirectories"
    ),
    textFileExtensions: ensureStringArray(
      value.textFileExtensions,
      "doctor.textFileExtensions"
    ),
    excludedPathPrefixes: ensureStringArray(
      value.excludedPathPrefixes,
      "doctor.excludedPathPrefixes"
    ),
    allowlist: normalizeAllowlist(value.allowlist, "doctor.allowlist"),
    scanRules: normalizeScanRules(value.scanRules, "doctor.scanRules")
  };
}

function parseConfigDocument(
  document: unknown,
  configPath: string
): Hagi18nConfig {
  if (document === undefined) {
    return {};
  }

  if (!isPlainObject(document)) {
    throw new Error(
      `Top-level YAML document in ${configPath} must be a mapping object.`
    );
  }

  return {
    localesRoot: ensureString(document.localesRoot, "localesRoot"),
    repoRoot: ensureString(document.repoRoot, "repoRoot"),
    baseLocale: ensureString(document.baseLocale, "baseLocale"),
    auditBaseLocales: ensureStringArray(
      document.auditBaseLocales,
      "auditBaseLocales"
    ),
    targetLocales: ensureStringArray(document.targetLocales, "targetLocales"),
    doctor: parseDoctorConfig(document.doctor)
  };
}

export async function findHagi18nConfigPath(
  options: LoadHagi18nConfigOptions = {}
): Promise<string | null> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const explicitConfigPath = options.configPath?.trim();

  if (explicitConfigPath) {
    return path.resolve(cwd, explicitConfigPath);
  }

  for (const fileName of DEFAULT_CONFIG_FILE_NAMES) {
    const candidate = path.join(cwd, fileName);
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

export async function loadHagi18nConfig(
  options: LoadHagi18nConfigOptions = {}
): Promise<LoadHagi18nConfigResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const configPath = await findHagi18nConfigPath({ ...options, cwd });

  if (!configPath) {
    return {
      cwd,
      configPath: null,
      config: null
    };
  }

  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read ${configPath}: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${configPath}: ${message}`);
  }

  return {
    cwd,
    configPath,
    config: parseConfigDocument(parsed, configPath)
  };
}

function compileScanRules(
  rules: DoctorScanRuleConfig[]
): ResolvedDoctorScanRule[] {
  return rules.map((rule) => ({
    ...rule,
    regex: new RegExp(rule.pattern, rule.flags ?? "u")
  }));
}

function resolveStringPath(
  value: string | undefined,
  baseDirectory: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return path.isAbsolute(value) ? value : path.resolve(baseDirectory, value);
}

function resolveConfigLayer(
  config: Hagi18nConfig | null | undefined,
  {
    cwd,
    configPath
  }: {
    cwd: string;
    configPath: string | null;
  }
): ResolvedConfigLayer {
  if (!config) {
    return {};
  }

  const baseDirectory = configPath ? path.dirname(configPath) : cwd;

  return {
    localesRoot: resolveStringPath(config.localesRoot, baseDirectory),
    repoRoot: resolveStringPath(config.repoRoot, baseDirectory),
    baseLocale: normalizeLocaleValue(config.baseLocale),
    auditBaseLocales: normalizeLocaleValues(config.auditBaseLocales),
    targetLocales: normalizeLocaleValues(config.targetLocales),
    doctor: {
      excludedDirectories: config.doctor?.excludedDirectories
        ? dedupeStrings(config.doctor.excludedDirectories)
        : undefined,
      textFileExtensions: config.doctor?.textFileExtensions
        ? dedupeStrings(config.doctor.textFileExtensions)
        : undefined,
      excludedPathPrefixes: config.doctor?.excludedPathPrefixes
        ? dedupeStrings(config.doctor.excludedPathPrefixes)
        : undefined,
      allowlist: config.doctor?.allowlist
        ? Object.fromEntries(
            Object.entries(config.doctor.allowlist).map(([ruleId, filePaths]) => [
              ruleId,
              dedupeStrings(filePaths)
            ])
          )
        : undefined,
      scanRules: config.doctor?.scanRules
        ? compileScanRules(config.doctor.scanRules)
        : undefined
    }
  };
}

function mergeAllowlists(
  baseAllowlist: Record<string, string[]>,
  overrideAllowlist?: Record<string, string[]>
): Record<string, string[]> {
  if (!overrideAllowlist) {
    return { ...baseAllowlist };
  }

  const merged: Record<string, string[]> = { ...baseAllowlist };
  for (const [ruleId, filePaths] of Object.entries(overrideAllowlist)) {
    merged[ruleId] = dedupeStrings(filePaths);
  }

  return merged;
}

function mergeResolvedDoctorConfig(
  baseConfig: ResolvedHagi18nDoctorConfig,
  overrideConfig?: Partial<ResolvedHagi18nDoctorConfig>
): ResolvedHagi18nDoctorConfig {
  if (!overrideConfig) {
    return {
      excludedDirectories: [...baseConfig.excludedDirectories],
      textFileExtensions: [...baseConfig.textFileExtensions],
      excludedPathPrefixes: [...baseConfig.excludedPathPrefixes],
      allowlist: mergeAllowlists(baseConfig.allowlist),
      scanRules: [...baseConfig.scanRules]
    };
  }

  return {
    excludedDirectories: overrideConfig.excludedDirectories
      ? [...overrideConfig.excludedDirectories]
      : [...baseConfig.excludedDirectories],
    textFileExtensions: overrideConfig.textFileExtensions
      ? [...overrideConfig.textFileExtensions]
      : [...baseConfig.textFileExtensions],
    excludedPathPrefixes: overrideConfig.excludedPathPrefixes
      ? [...overrideConfig.excludedPathPrefixes]
      : [...baseConfig.excludedPathPrefixes],
    allowlist: mergeAllowlists(baseConfig.allowlist, overrideConfig.allowlist),
    scanRules: overrideConfig.scanRules
      ? [...overrideConfig.scanRules]
      : [...baseConfig.scanRules]
  };
}

function createDefaultResolvedConfig(cwd: string): ResolvedHagi18nConfig {
  return {
    cwd,
    configPath: null,
    localesRoot: path.resolve(cwd, "src/locales"),
    repoRoot: cwd,
    baseLocale: DEFAULT_BASE_LOCALE,
    auditBaseLocales: [DEFAULT_BASE_LOCALE],
    targetLocales: [],
    doctor: {
      excludedDirectories: [...DEFAULT_DOCTOR_EXCLUDED_DIRECTORIES],
      textFileExtensions: [...DEFAULT_DOCTOR_TEXT_FILE_EXTENSIONS],
      excludedPathPrefixes: [...DEFAULT_DOCTOR_EXCLUDED_PATH_PREFIXES],
      allowlist: { ...DEFAULT_DOCTOR_ALLOWLIST },
      scanRules: compileScanRules(DEFAULT_DOCTOR_SCAN_RULES)
    }
  };
}

export async function resolveHagi18nConfig(
  options: ResolveHagi18nConfigOptions = {}
): Promise<ResolvedHagi18nConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const loaded = await loadHagi18nConfig({
    cwd,
    configPath: options.configPath
  });
  const defaults = createDefaultResolvedConfig(cwd);
  const fileLayer = resolveConfigLayer(loaded.config, loaded);
  const overrideLayer = resolveConfigLayer(
    {
      localesRoot: options.localesRoot,
      repoRoot: options.repoRoot,
      baseLocale: options.baseLocale,
      auditBaseLocales: options.auditBaseLocales,
      targetLocales: options.targetLocales,
      doctor: options.doctor
    },
    {
      cwd,
      configPath: null
    }
  );

  const mergedDoctor = mergeResolvedDoctorConfig(
    mergeResolvedDoctorConfig(defaults.doctor, fileLayer.doctor),
    overrideLayer.doctor
  );
  const mergedBaseLocale =
    overrideLayer.baseLocale ?? fileLayer.baseLocale ?? defaults.baseLocale;
  const mergedAuditBaseLocales =
    overrideLayer.auditBaseLocales && overrideLayer.auditBaseLocales.length > 0
      ? overrideLayer.auditBaseLocales
      : overrideLayer.baseLocale
        ? [mergedBaseLocale]
        : fileLayer.auditBaseLocales && fileLayer.auditBaseLocales.length > 0
          ? fileLayer.auditBaseLocales
          : [mergedBaseLocale];

  return {
    cwd,
    configPath: loaded.configPath,
    localesRoot: overrideLayer.localesRoot ?? fileLayer.localesRoot ?? defaults.localesRoot,
    repoRoot: overrideLayer.repoRoot ?? fileLayer.repoRoot ?? defaults.repoRoot,
    baseLocale: mergedBaseLocale,
    auditBaseLocales: mergedAuditBaseLocales,
    targetLocales:
      overrideLayer.targetLocales ??
      fileLayer.targetLocales ??
      defaults.targetLocales,
    doctor: mergedDoctor
  };
}
