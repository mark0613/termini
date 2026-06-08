import { readFileSync, writeFileSync } from "node:fs";

const packageJsonPath = "package.json";
const tauriConfigPath = "src-tauri/tauri.conf.json";
const cargoTomlPath = "src-tauri/Cargo.toml";
const cargoLockPath = "src-tauri/Cargo.lock";
const packageName = "termini";

const inputVersion = process.argv[2];

if (!inputVersion || inputVersion === "--help" || inputVersion === "-h") {
  console.log("Usage: pnpm version:set <x.y.z>");
  process.exit(inputVersion ? 0 : 1);
}

const version = inputVersion.trim().replace(/^v/, "");

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Version "${inputVersion}" must be stable SemVer in x.y.z format`);
}

function updateJsonVersion(path) {
  const text = readFileSync(path, "utf8");
  const eol = detectEol(text);
  const json = JSON.parse(text);
  json.version = version;
  writeFileSync(path, `${JSON.stringify(json, null, 2).replace(/\n/g, eol)}${eol}`);
}

function updateCargoTomlVersion(path) {
  const text = readFileSync(path, "utf8");
  const eol = detectEol(text);
  let inPackageSection = false;
  let updated = false;

  const nextText = text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();

      if (/^\[[^\]]+\]$/.test(trimmed)) {
        inPackageSection = trimmed === "[package]";
        return line;
      }

      if (inPackageSection && /^version\s*=/.test(trimmed)) {
        updated = true;
        return line.replace(/version\s*=\s*"[^"]+"/, `version = "${version}"`);
      }

      return line;
    })
    .join(eol);

  if (!updated) {
    throw new Error(`Missing [package].version in ${path}`);
  }

  writeFileSync(path, nextText);
}

function updateCargoLockVersion(path) {
  const text = readFileSync(path, "utf8");
  const eol = detectEol(text);
  let inMatchingPackage = false;
  let updated = false;

  const nextText = text
    .split(/\r?\n/)
    .map((line) => {
      if (line.trim() === "[[package]]") {
        inMatchingPackage = false;
        return line;
      }

      if (line.trim() === `name = "${packageName}"`) {
        inMatchingPackage = true;
        return line;
      }

      if (inMatchingPackage && /^version\s*=/.test(line.trim())) {
        updated = true;
        return line.replace(/version\s*=\s*"[^"]+"/, `version = "${version}"`);
      }

      return line;
    })
    .join(eol);

  if (!updated) {
    throw new Error(`Missing ${packageName} package version in ${path}`);
  }

  writeFileSync(path, nextText);
}

function detectEol(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

updateJsonVersion(packageJsonPath);
updateJsonVersion(tauriConfigPath);
updateCargoTomlVersion(cargoTomlPath);
updateCargoLockVersion(cargoLockPath);

console.log(`Set ${packageName} version to ${version}`);
