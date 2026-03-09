import * as fs from "node:fs";
import * as path from "node:path";

import { createDirSync } from "./mktemp";

type Obj = Record<string, string | null>;

function makeOrRemake(obj: Obj, prop: string, className?: string): string {
  if (obj[prop] != null) {
    remake(obj, prop);
    return obj[prop];
  }
  return (obj[prop] = makeTmpDir(obj, prop, className));
}

function makeOrReuse(obj: Obj, prop: string, className?: string): string {
  if (obj[prop] != null) {
    return obj[prop];
  }
  return (obj[prop] = makeTmpDir(obj, prop, className));
}

function remake(obj: Obj, prop: string): void {
  const fullpath = obj[prop];
  if (fullpath != null) {
    fs.rmSync(fullpath);
    fs.mkdirSync(fullpath);
  }
}

function remove(obj: Obj, prop: string): void {
  if (obj[prop] != null) {
    fs.rmSync(obj[prop]);
  }
  obj[prop] = null;
}

function makeTmpDir(obj: Obj, prop: string, className?: string): string {
  if (className == null) className = obj.constructor && obj.constructor.name;
  const tmpDirName = prettyTmpDirName(className, prop);
  return createDirSync(path.join(findBaseDir(), tmpDirName));
}

function currentTmp() {
  return path.join(process.cwd(), "tmp");
}

function findBaseDir() {
  const tmp = currentTmp();
  try {
    if (fs.statSync(tmp).isDirectory()) {
      return tmp;
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    // We could try other directories, but for now we just create ./tmp if
    // it doesn't exist
    fs.mkdirSync(tmp);
    return tmp;
  }
}

function underscored(str: string) {
  return str
    .trim()
    .replace(/([a-z\d])([A-Z]+)/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function cleanString(s: string): string {
  return underscored(s || "")
    .replace(/[^a-z_]/g, "")
    .replace(/^_+/, "");
}

function prettyTmpDirName(className: string, prop: string) {
  let cleanClassName = cleanString(className);
  if (cleanClassName === "object") cleanClassName = "";
  if (cleanClassName) cleanClassName += "-";
  const cleanPropertyName = cleanString(prop);
  return cleanClassName + cleanPropertyName + "-XXXXXXXX.tmp";
}

export { makeOrRemake, makeOrReuse, remake, remove };
