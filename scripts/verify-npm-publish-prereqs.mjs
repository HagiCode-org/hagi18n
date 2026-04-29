#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const packageJsonPath = path.resolve(process.argv[2] ?? "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const packageName = String(packageJson.name ?? "");
const scopeMatch = packageName.match(/^@(?<scope>[^/]+)\//u);
const repositoryUrl = normalizeRepositoryUrl(packageJson.repository);
const expectedRepository = "github.com/HagiCode-org/hagi18n";
const expectedGitHubRepository = "HagiCode-org/hagi18n";
const workflowPath =
  process.env.GITHUB_WORKFLOW_REF?.split("@", 1)[0] ??
  "HagiCode-org/hagi18n/.github/workflows/npm-publish.yml";

if (!scopeMatch?.groups?.scope) {
  throw new Error(
    `Package name ${packageName} is unscoped. This preflight is intended for scoped npm packages.`
  );
}

const scope = scopeMatch.groups.scope;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

process.stdout.write(
  [
    `Package: ${packageName}`,
    `npm scope: @${scope}`,
    `Repository URL: ${repositoryUrl ?? "<missing>"}`,
    `GitHub repository: ${process.env.GITHUB_REPOSITORY ?? expectedGitHubRepository}`,
    `GitHub workflow ref: ${process.env.GITHUB_WORKFLOW_REF ?? "<local>"}`,
    `Trusted publisher workflow path: ${workflowPath}`
  ].join("\n") + "\n"
);

if (!repositoryUrl?.includes(expectedRepository)) {
  throw new Error(
    `package.json repository.url must point to ${expectedRepository} for npm trusted publishing. Received: ${repositoryUrl ?? "<missing>"}`
  );
}

if (
  process.env.GITHUB_REPOSITORY &&
  process.env.GITHUB_REPOSITORY !== expectedGitHubRepository
) {
  throw new Error(
    `This npm trusted publisher is expected to run from ${expectedGitHubRepository}. Received: ${process.env.GITHUB_REPOSITORY}`
  );
}

runNpm(["ping", "--registry", "https://registry.npmjs.org"], {
  failureMessage: "Unable to reach https://registry.npmjs.org."
});

const scopeExists = npmView(`@${scope}`, npmCommand);
if (!scopeExists) {
  process.stdout.write(
    [
      `npm scope @${scope} is not visible via npm view on https://registry.npmjs.org.`,
      "This can be normal before the first package exists because npm scopes are not package documents.",
      `Publish will still require an npm organization/user scope named '${scope}' with trusted publisher access for ${packageName}.`,
      "If the scope is missing or inaccessible, npm publish usually fails with E404 Not Found on PUT."
    ].join("\n") + "\n"
  );
}

const packageExists = npmView(packageName, npmCommand);
if (!packageExists) {
  process.stdout.write(
    [
      `Package ${packageName} does not exist yet; npm publish will create it if the workflow identity has access to @${scope}.`,
      "For GitHub Actions trusted publishing, configure npm trusted publisher access for this repository before publishing.",
      "npm package: @hagicode/hagi18n",
      "GitHub owner: HagiCode-org",
      "GitHub repository: hagi18n",
      "Workflow filename: npm-publish.yml",
      "Workflow path: .github/workflows/npm-publish.yml",
      "Environment: leave empty unless the npm trusted publisher entry requires one."
    ].join("\n") + "\n"
  );
} else {
  process.stdout.write(`Package ${packageName} exists on npm.\n`);
}

process.stdout.write(
  `npm publish prerequisites look valid for ${packageName}.\n`
);

function npmView(name, command) {
  const result = spawnSync(
    command,
    ["view", name, "name", "--registry", "https://registry.npmjs.org"],
    {
      stdio: "ignore"
    }
  );

  return result.status === 0;
}

function runNpm(args, options) {
  const result = spawnSync(npmCommand, args, {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(
      `${options.failureMessage}\nCommand failed with exit code ${result.status}: ${npmCommand} ${args.join(" ")}`
    );
  }
}

function normalizeRepositoryUrl(repository) {
  const url = typeof repository === "string" ? repository : repository?.url;
  if (typeof url !== "string" || url.length === 0) {
    return undefined;
  }

  return url
    .replace(/^git\+/u, "")
    .replace(/^https?:\/\//u, "")
    .replace(/^git@github\.com:/u, "github.com/")
    .replace(/\.git$/u, "");
}
