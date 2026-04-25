import * as cnst from "node:constants";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

interface OpenFile {
  path: string;
  fd: number;
}
interface Stats {
  files: number;
  dirs: number;
}
interface AffixOptions {
  prefix?: string | undefined;
  suffix?: string | undefined;
  dir?: string | undefined;
}

function promisify(callback) {
  if (typeof callback === "function") {
    return [undefined, callback] as const;
  }
  let promiseCallback;
  const promise = new Promise(function (resolve, reject) {
    promiseCallback = function () {
      const args = Array.from(arguments);
      const err = args.shift();
      process.nextTick(function () {
        if (err) {
          reject(err);
        } else if (args.length === 1) {
          resolve(args[0]);
        } else {
          resolve(args);
        }
      });
    };
  });
  return [promise, promiseCallback] as const;
}

// oxlint-disable-next-line prefer-const
let dir: string = path.resolve(os.tmpdir());
const RDWR_EXCL = cnst.O_CREAT | cnst.O_TRUNC | cnst.O_RDWR | cnst.O_EXCL;

function generateName(
  rawAffixes?: string | AffixOptions,
  defaultPrefix?: string,
): string {
  const affixes = parseAffixes(rawAffixes, defaultPrefix);
  const now = new Date();
  const name = [
    affixes.prefix,
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    "-",
    process.pid,
    "-",
    (Math.random() * 0x100000000 + 1).toString(36),
    affixes.suffix,
  ].join("");
  return path.join(affixes.dir || dir, name);
}

function parseAffixes(
  rawAffixes?: string | AffixOptions,
  defaultPrefix?: string,
): AffixOptions {
  const affixes: AffixOptions = { prefix: undefined, suffix: undefined };
  if (!rawAffixes) {
    affixes.prefix = defaultPrefix;
    return affixes;
  }
  if (typeof rawAffixes === "object") {
    return rawAffixes;
  }
  affixes.prefix = rawAffixes;
  return affixes;
}

/* -------------------------------------------------------------------------
 * Don't forget to call track() if you want file tracking and exit handlers!
 * -------------------------------------------------------------------------
 * When any temp file or directory is created, it is added to filesToDelete
 * or dirsToDelete. The first time any temp file is created, a listener is
 * added to remove all temp files and directories at exit.
 */

let tracking = false;

function track(value: boolean = true): void {
  tracking = value !== false;
}

let exitListenerAttached = false;
const filesToDelete: string[] = [];
const dirsToDelete: string[] = [];

function deleteFileOnExit(filePath: string): void {
  if (!tracking) return;
  attachExitListener();
  filesToDelete.push(filePath);
}

function deleteDirOnExit(dirPath: string): void {
  if (!tracking) return;
  attachExitListener();
  dirsToDelete.push(dirPath);
}

function attachExitListener(): void {
  if (!tracking) return;
  if (!exitListenerAttached) {
    process.addListener("exit", function () {
      try {
        cleanupSync();
      } catch (err) {
        console.warn("Fail to clean temporary files on exit : ", err);
        throw err;
      }
    });
    exitListenerAttached = true;
  }
}

function cleanupFilesSync(): number {
  if (!tracking) {
    return 0;
  }
  let count = 0;
  let toDelete;
  while ((toDelete = filesToDelete.shift()) !== undefined) {
    fs.rmSync(toDelete, { maxRetries: 6, recursive: true, force: true });
    count++;
  }
  return count;
}

function cleanupFiles(callback: (err: Error | null, count?: number) => void) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];
  if (!tracking) {
    callback(new Error("not tracking"));
    return promise;
  }
  let count = 0;
  let left = filesToDelete.length;
  if (!left) {
    callback(null, count);
    return promise;
  }
  let toDelete;
  const rimrafCallback: fs.NoParamCallback = function (err) {
    if (!left) {
      // Prevent processing if aborted
      return;
    }
    if (err) {
      // This shouldn't happen; pass error to callback and abort
      // processing
      callback(err);
      left = 0;
      return;
    } else {
      count++;
    }
    left--;
    if (!left) {
      callback(null, count);
    }
  };
  while ((toDelete = filesToDelete.shift()) !== undefined) {
    fs.rm(
      toDelete,
      { maxRetries: 6, recursive: true, force: true },
      rimrafCallback,
    );
  }
  return promise;
}

function cleanupDirsSync(): number {
  if (!tracking) {
    return 0;
  }
  let count = 0;
  let toDelete;
  while ((toDelete = dirsToDelete.shift()) !== undefined) {
    fs.rmSync(toDelete, { maxRetries: 6, recursive: true, force: true });
    count++;
  }
  return count;
}

function cleanupDirs(callback: (err: Error | null, count?: number) => void) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];
  if (!tracking) {
    callback(new Error("not tracking"));
    return promise;
  }
  let count = 0;
  let left = dirsToDelete.length;
  if (!left) {
    callback(null, count);
    return promise;
  }
  let toDelete;
  const rimrafCallback: fs.NoParamCallback = function (err) {
    if (!left) {
      // Prevent processing if aborted
      return;
    }
    if (err) {
      // rimraf handles most "normal" errors; pass the error to the
      // callback and abort processing
      callback(err, count);
      left = 0;
      return;
    } else {
      count++;
    }
    left--;
    if (!left) {
      callback(null, count);
    }
  };
  while ((toDelete = dirsToDelete.shift()) !== undefined) {
    fs.rm(
      toDelete,
      { maxRetries: 6, recursive: true, force: true },
      rimrafCallback,
    );
  }
  return promise;
}

function cleanupSync(): false | Stats {
  if (!tracking) {
    return false;
  }
  const fileCount = cleanupFilesSync();
  const dirCount = cleanupDirsSync();
  return { files: fileCount, dirs: dirCount };
}

// oxlint-disable-next-line typescript/no-explicit-any
function cleanup(callback: (err: any, result?: Stats) => void): void;
function cleanup(): Promise<Stats>;

function cleanup(callback?) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];
  if (!tracking) {
    callback(new Error("not tracking"));
    return promise;
  }
  cleanupFiles(function (fileErr, fileCount) {
    if (fileErr) {
      callback(fileErr, { files: fileCount });
    } else {
      cleanupDirs(function (dirErr, dirCount) {
        callback(dirErr, { files: fileCount, dirs: dirCount });
      });
    }
  });
  return promise;
}

function mkdir(
  affixes: string | AffixOptions | undefined,
  // oxlint-disable-next-line typescript/no-explicit-any
  callback: (err: any, dirPath: string) => void,
): void;
function mkdir(affixes?: string | AffixOptions): Promise<string>;

function mkdir(affixes?: string | AffixOptions, callback?) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];
  const dirPath = generateName(affixes, "d-");
  fs.mkdir(dirPath, { mode: 0o700, recursive: true }, (err) => {
    if (!err) {
      deleteDirOnExit(dirPath);
    }
    callback(err, dirPath);
  });
  return promise;
}

function mkdirSync(affixes?: string | AffixOptions): string {
  const dirPath = generateName(affixes, "d-");
  fs.mkdirSync(dirPath, { mode: 0o700, recursive: true });
  deleteDirOnExit(dirPath);
  return dirPath;
}

function open(
  affixes: string | AffixOptions | undefined,
  // oxlint-disable-next-line typescript/no-explicit-any
  callback: (err: any, result: OpenFile) => void,
): void;
function open(affixes?: string | AffixOptions): Promise<OpenFile>;

function open(affixes?: string | AffixOptions, callback?) {
  const p = promisify(callback);
  const promise = p[0];
  callback = p[1];
  const path = generateName(affixes, "f-");
  fs.open(path, RDWR_EXCL, 0o600, (err, fd) => {
    if (!err) {
      deleteFileOnExit(path);
    }
    callback(err, { path, fd });
  });
  return promise;
}

function openSync(affixes?: string | AffixOptions): OpenFile {
  const path = generateName(affixes, "f-");
  const fd = fs.openSync(path, RDWR_EXCL, 0o600);
  deleteFileOnExit(path);
  return { path, fd };
}

function createWriteStream(affixes?: string | AffixOptions): fs.WriteStream {
  const path = generateName(affixes, "s-");
  const stream = fs.createWriteStream(path, {
    flags: `${RDWR_EXCL}`,
    mode: 0o600,
  });
  deleteFileOnExit(path);
  return stream;
}

export {
  dir,
  track,
  mkdir,
  mkdirSync,
  open,
  openSync,
  generateName as path,
  cleanup,
  cleanupSync,
  createWriteStream,
};
export type { OpenFile, Stats, AffixOptions };
