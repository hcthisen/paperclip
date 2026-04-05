import { copyFile, mkdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseArgs, optionalStringArg, writeJsonFile, writeTextFile, isoDateStamp } from "./titan-claws-goalloop-lib.ts";

const execFileAsync = promisify(execFile);

function expandHome(value: string) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

async function run(file: string, args: string[], options?: { cwd?: string }) {
  const result = await execFileAsync(file, args, {
    cwd: options?.cwd,
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.stdout.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stamp = isoDateStamp();
  const bundleDir = expandHome(
    optionalStringArg(args, "bundle-dir") ?? `~/cutovers/${stamp}-titan-claws-goalloop`,
  );
  const repoDir = expandHome(optionalStringArg(args, "repo-dir") ?? "/opt/paperclip");
  const configPath = expandHome(
    optionalStringArg(args, "config-path") ?? "~/.paperclip/instances/default/config.json",
  );
  const serviceName = optionalStringArg(args, "service-name") ?? "paperclip.service";
  const backupDir = path.join(bundleDir, "db-backups");

  await mkdir(bundleDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });

  const serviceConfig = await run("systemctl", ["cat", serviceName]);
  const serviceStatus = await run("systemctl", ["status", "--no-pager", serviceName]);
  const repoHead = await run("git", ["-C", repoDir, "rev-parse", "HEAD"]);
  const repoStatus = await run("git", ["-C", repoDir, "-c", `safe.directory=${repoDir}`, "status", "--short"]);
  const repoDiffStat = await run("git", ["-C", repoDir, "-c", `safe.directory=${repoDir}`, "diff", "--stat"]);

  await writeTextFile(path.join(bundleDir, "systemd-unit.txt"), `${serviceConfig}\n`);
  await writeTextFile(path.join(bundleDir, "systemd-status.txt"), `${serviceStatus}\n`);
  await writeTextFile(path.join(bundleDir, "repo-head.txt"), `${repoHead}\n`);
  await writeTextFile(path.join(bundleDir, "repo-status.txt"), `${repoStatus}\n`);
  await writeTextFile(path.join(bundleDir, "repo-diff-stat.txt"), `${repoDiffStat}\n`);

  try {
    await copyFile(configPath, path.join(bundleDir, "config.json"));
  } catch (error) {
    throw new Error(`Failed to copy config file from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  await execFileAsync(
    "tar",
    ["-czf", path.join(bundleDir, "repo-tree.tgz"), "--exclude=.git", "--exclude=node_modules", "-C", repoDir, "."],
    {
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const backupRaw = await run(
    "pnpm",
    [
      "--dir",
      repoDir,
      "paperclipai",
      "db:backup",
      "--dir",
      backupDir,
      "--filename-prefix",
      "titan-claws-pre-goalloop",
      "--json",
    ],
    { cwd: repoDir },
  );

  const backupMetadata = JSON.parse(backupRaw);
  const repoTreeStats = await stat(path.join(bundleDir, "repo-tree.tgz"));

  await writeJsonFile(path.join(bundleDir, "manifest.json"), {
    generatedAt: new Date().toISOString(),
    serviceName,
    repoDir,
    configPath,
    repoHead,
    backupMetadata,
    artifacts: {
      serviceConfig: "systemd-unit.txt",
      serviceStatus: "systemd-status.txt",
      repoStatus: "repo-status.txt",
      repoDiffStat: "repo-diff-stat.txt",
      configCopy: "config.json",
      repoTree: {
        path: "repo-tree.tgz",
        sizeBytes: repoTreeStats.size,
      },
      dbBackupDir: "db-backups",
    },
  });

  console.log(`Titan Claws rollback bundle created at ${bundleDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
