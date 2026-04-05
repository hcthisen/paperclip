import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

export function requireStringArg(args: Map<string, string | boolean>, key: string) {
  const value = args.get(key);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required --${key}`);
  }
  return value.trim();
}

export function optionalStringArg(args: Map<string, string | boolean>, key: string) {
  const value = args.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function booleanArg(args: Map<string, string | boolean>, key: string) {
  return args.get(key) === true;
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeTextFile(filePath: string, value: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, "utf8");
}

export function isoDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
