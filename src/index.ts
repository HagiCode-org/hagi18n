import { packageName, packageVersion } from "./version.js";

export {
  DEFAULT_BASE_LOCALE,
  DEFAULT_CONFIG_FILE_NAMES,
  DEFAULT_DOCTOR_ALLOWLIST,
  DEFAULT_DOCTOR_EXCLUDED_DIRECTORIES,
  DEFAULT_DOCTOR_EXCLUDED_PATH_PREFIXES,
  DEFAULT_DOCTOR_SCAN_RULES,
  DEFAULT_DOCTOR_TEXT_FILE_EXTENSIONS,
  findHagi18nConfigPath,
  loadHagi18nConfig,
  resolveHagi18nConfig,
  type DoctorScanRuleConfig,
  type Hagi18nConfig,
  type Hagi18nDoctorConfig,
  type LoadHagi18nConfigOptions,
  type LoadHagi18nConfigResult,
  type ResolvedDoctorScanRule,
  type ResolvedHagi18nConfig,
  type ResolvedHagi18nDoctorConfig,
  type ResolveHagi18nConfigOptions
} from "./config.js";

export {
  auditHasIssues,
  auditLocaleTree,
  collectPlaceholderDifferences,
  collectPlaceholders,
  collectScalarPaths,
  createAuditResult,
  difference,
  doctorLocaleTree,
  formatAuditSummary,
  formatDoctorSummary,
  formatMutationSummary,
  listLocaleDirectories,
  normalizeLocaleName,
  pruneLocaleTree,
  readYamlLocaleFile,
  syncLocaleTree,
  walkYamlFiles,
  type AuditLocaleResult,
  type AuditLocaleTreeSummary,
  type DoctorLocaleTreeSummary,
  type DoctorRuleIssue,
  type LocaleMutationParseError,
  type LocaleParseError,
  type LocalePathIssue,
  type LocalePlaceholderMismatch,
  type LocaleToolkitOptions,
  type MutationChangedFile,
  type MutationLocaleToolkitOptions,
  type MutationRemovedFile,
  type MutationSummary,
  type MutationTotals,
  type YamlLocaleDocument
} from "./locale-toolkit.js";

export {
  getPackageMetadata,
  packageName,
  packageVersion,
  type PackageMetadata
} from "./version.js";

export interface Hagi18nRuntimeInfo {
  packageName: string;
  version: string;
  status: "foundation";
}

export function createRuntimeInfo(): Hagi18nRuntimeInfo {
  return {
    packageName,
    version: packageVersion,
    status: "foundation"
  };
}
