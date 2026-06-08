import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const tauriConfigPath = "src-tauri/tauri.conf.json";
const packageJsonPath = "package.json";
const cargoTomlPath = "src-tauri/Cargo.toml";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readCargoPackageVersion(text) {
  let inPackageSection = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (/^\[[^\]]+\]$/.test(line)) {
      inPackageSection = line === "[package]";
      continue;
    }

    if (!inPackageSection) continue;

    const match = line.match(/^version\s*=\s*"([^"]+)"\s*$/);
    if (match) return match[1];
  }

  throw new Error(`Missing [package].version in ${cargoTomlPath}`);
}

function readCurrentVersions() {
  const packageVersion = readJson(packageJsonPath).version;
  const tauriVersion = readJson(tauriConfigPath).version;
  const cargoVersion = readCargoPackageVersion(readFileSync(cargoTomlPath, "utf8"));

  return { packageVersion, tauriVersion, cargoVersion };
}

function readPreviousTauriVersion(beforeSha) {
  if (!beforeSha || /^0+$/.test(beforeSha)) return null;

  try {
    const previousConfig = execFileSync(
      "git",
      ["show", `${beforeSha}:${tauriConfigPath}`],
      { encoding: "utf8" },
    );

    return JSON.parse(previousConfig).version;
  } catch (error) {
    if (error.status === 128) return null;
    throw error;
  }
}

function parseStableSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Version "${version}" must be stable SemVer in x.y.z format`);
  }

  return match.slice(1).map(Number);
}

function compareSemver(left, right) {
  const leftParts = parseStableSemver(left);
  const rightParts = parseStableSemver(right);

  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }

  return 0;
}

function tagExists(version) {
  try {
    execFileSync(
      "git",
      ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/v${version}`],
      { stdio: "ignore" },
    );
    return true;
  } catch (error) {
    if (error.status === 2) return false;
    throw error;
  }
}

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    console.log(`${name}=${value}`);
    return;
  }

  appendFileSync(outputPath, `${name}=${value}\n`);
}

function skip(version, previousVersion, reason) {
  setOutput("should_release", "false");
  setOutput("version", version);
  setOutput("previous_version", previousVersion ?? "");
  setOutput("reason", reason);
  console.log(reason);
}

const { packageVersion, tauriVersion, cargoVersion } = readCurrentVersions();
const versions = [packageVersion, tauriVersion, cargoVersion];
const uniqueVersions = new Set(versions);

if (uniqueVersions.size !== 1) {
  throw new Error(
    [
      "Version mismatch:",
      `${packageJsonPath}: ${packageVersion}`,
      `${tauriConfigPath}: ${tauriVersion}`,
      `${cargoTomlPath}: ${cargoVersion}`,
    ].join("\n"),
  );
}

parseStableSemver(tauriVersion);

const previousVersion = readPreviousTauriVersion(process.env.GITHUB_EVENT_BEFORE);
if (!previousVersion) {
  skip(tauriVersion, previousVersion, "No previous app version found; skipping push release.");
  process.exit(0);
}

if (previousVersion && tauriVersion === previousVersion) {
  skip(tauriVersion, previousVersion, "Version did not change; skipping release.");
  process.exit(0);
}

if (previousVersion && compareSemver(tauriVersion, previousVersion) <= 0) {
  throw new Error(
    `Current version ${tauriVersion} must be greater than previous version ${previousVersion}`,
  );
}

if (tagExists(tauriVersion)) {
  throw new Error(`Tag v${tauriVersion} already exists`);
}

setOutput("should_release", "true");
setOutput("version", tauriVersion);
setOutput("previous_version", previousVersion ?? "");
setOutput(
  "reason",
  previousVersion
    ? "Version changed and release checks passed."
    : "First app release checks passed.",
);
console.log(
  previousVersion
    ? `Release approved: ${previousVersion} -> ${tauriVersion}`
    : `First app release approved: v${tauriVersion}`,
);
