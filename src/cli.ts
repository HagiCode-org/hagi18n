#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command, CommanderError, Option } from "commander";
import {
  auditLocaleTree,
  createRuntimeInfo,
  doctorLocaleTree,
  formatAuditSummary,
  formatDoctorSummary,
  formatMutationSummary,
  packageVersion,
  pruneLocaleTree,
  syncLocaleTree,
  type AuditLocaleTreeSummary,
  type DoctorLocaleTreeSummary,
  type MutationSummary
} from "./index.js";

interface CliCommandOptions {
  config?: string;
  localesRoot?: string;
  baseLocale?: string;
  from?: string;
  locale?: string[];
  to?: string[];
  repoRoot?: string;
  json?: boolean;
  dryRun?: boolean;
  write?: boolean;
}

type SummaryFormatter =
  | ((summary: AuditLocaleTreeSummary) => string)
  | ((summary: DoctorLocaleTreeSummary) => string)
  | ((summary: MutationSummary) => string);

function collectValues(value: string, previous: string[] = []): string[] {
  previous.push(value);
  return previous;
}

function toToolkitOptions(options: CliCommandOptions) {
  const targetLocales = [...(options.locale ?? []), ...(options.to ?? [])];

  return {
    configPath: options.config,
    localesRoot: options.localesRoot,
    repoRoot: options.repoRoot,
    baseLocale: options.baseLocale ?? options.from,
    targetLocales: targetLocales.length > 0 ? targetLocales : undefined
  };
}

function resolveDryRun(options: CliCommandOptions): boolean {
  if (options.dryRun) {
    return true;
  }

  return !options.write;
}

function printSummary(
  summary: AuditLocaleTreeSummary | DoctorLocaleTreeSummary | MutationSummary,
  {
    json = false,
    formatter
  }: {
    json?: boolean;
    formatter: SummaryFormatter;
  }
): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }

  process.stdout.write(`${formatter(summary as never)}\n`);
}

function applySharedOptions(command: Command, { includeRepoRoot = false }: { includeRepoRoot?: boolean } = {}): Command {
  command
    .addOption(new Option("--config <path>", "load defaults from a hagi18n.yaml file"))
    .addOption(
      new Option("--locales-root <path>", "locale root directory")
    )
    .addOption(
      new Option("--base-locale <locale>", "base locale to compare against")
    )
    .addOption(new Option("--from <locale>", "source locale used as the structure baseline"))
    .addOption(
      new Option("--locale <locale>", "limit the command to one or more locales").argParser(collectValues)
    )
    .addOption(
      new Option("--to <locale>", "target locale; can be repeated").argParser(collectValues)
    )
    .addOption(new Option("--json", "print machine-readable JSON output"));

  if (includeRepoRoot) {
    command.addOption(new Option("--repo-root <path>", "repository root for doctor scanning"));
  }

  return command;
}

function applyMutationOptions(command: Command): Command {
  return applySharedOptions(command)
    .addOption(new Option("--dry-run", "preview changes without writing files"))
    .addOption(new Option("--write", "apply file mutations"));
}

export function createCli(): Command {
  const program = new Command();

  program
    .name("hagi18n")
    .description("Hagi18n YAML locale maintenance toolkit.")
    .version(packageVersion, "-v, --version", "print the hagi18n version");
  program.showHelpAfterError();
  program.exitOverride();

  program
    .command("info")
    .description("print package foundation metadata")
    .action(() => {
      const info = createRuntimeInfo();
      process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
    });

  applySharedOptions(
    program
      .command("audit")
      .description("audit YAML locale files for drift against a base locale")
      .action(async (options: CliCommandOptions) => {
        const summary = await auditLocaleTree(toToolkitOptions(options));
        printSummary(summary, {
          json: options.json,
          formatter: formatAuditSummary
        });
        process.exitCode = summary.hasIssues ? 1 : 0;
      })
  );

  applySharedOptions(
    program
      .command("report")
      .description("run audit and print JSON output")
      .action(async (options: CliCommandOptions) => {
        const summary = await auditLocaleTree(toToolkitOptions(options));
        printSummary(summary, {
          json: true,
          formatter: formatAuditSummary
        });
        process.exitCode = summary.hasIssues ? 1 : 0;
      })
  );

  applySharedOptions(
    program
      .command("doctor")
      .description("audit locale drift and scan the repository for legacy locale references")
      .action(async (options: CliCommandOptions) => {
        const summary = await doctorLocaleTree(toToolkitOptions(options));
        printSummary(summary, {
          json: options.json,
          formatter: formatDoctorSummary
        });
        process.exitCode = summary.hasIssues ? 1 : 0;
      }),
    { includeRepoRoot: true }
  );

  applyMutationOptions(
    program
      .command("sync")
      .description("add missing files and keys from the base locale")
      .action(async (options: CliCommandOptions) => {
        const summary = await syncLocaleTree({
          ...toToolkitOptions(options),
          dryRun: resolveDryRun(options)
        });
        printSummary(summary, {
          json: options.json,
          formatter: formatMutationSummary
        });
        process.exitCode = summary.hasIssues ? 1 : 0;
      })
  );

  applyMutationOptions(
    program
      .command("prune")
      .description("remove files and keys absent from the base locale")
      .action(async (options: CliCommandOptions) => {
        const summary = await pruneLocaleTree({
          ...toToolkitOptions(options),
          dryRun: resolveDryRun(options)
        });
        printSummary(summary, {
          json: options.json,
          formatter: formatMutationSummary
        });
        process.exitCode = summary.hasIssues ? 1 : 0;
      })
  );

  program.addHelpText(
    "after",
    `

Examples:
  hagi18n audit --locales-root src/locales --base-locale en-US
  hagi18n report --config hagi18n.yaml
  hagi18n doctor --repo-root . --locales-root src/locales
  hagi18n sync --from en-US --to zh-CN --dry-run
  hagi18n prune --from en-US --to zh-CN --write
`
  );

  program.action(() => {
    program.outputHelp();
  });

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createCli();
  process.exitCode = 0;

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
      return;
    }

    throw error;
  }
}

export function isCliEntrypoint(
  moduleUrl = import.meta.url,
  argvPath = process.argv[1]
): boolean {
  if (!argvPath) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvPath);
  } catch {
    return false;
  }
}

if (isCliEntrypoint()) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
