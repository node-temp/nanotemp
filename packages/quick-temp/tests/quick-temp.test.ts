import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import * as quickTemp from "@nanotemp/quick-temp";

let obj;

describe("quick-temp", () => {
  beforeEach(() => {
    obj = {};
  });

  afterEach(() => {
    quickTemp.remove(obj, "tmpDir");
  });

  it("creates a temporary directory with makeOrRemake", () => {
    const dir = quickTemp.makeOrRemake(obj, "tmpDir", "MyClass");
    expect(dir).toBeString();
    expect(fs.existsSync(dir)).toBeTrue();
    expect(obj.tmpDir).toEqual(dir);
  });

  it("reuses the directory with makeOrReuse", () => {
    const first = quickTemp.makeOrReuse(obj, "tmpDir", "MyClass");
    const second = quickTemp.makeOrReuse(obj, "tmpDir", "MyClass");
    expect(first).toEqual(second);
  });

  it("remake clears the directory contents", () => {
    const dir = quickTemp.makeOrReuse(obj, "tmpDir", "MyClass");
    fs.writeFileSync(path.join(dir, "file.txt"), "content");
    expect(fs.existsSync(path.join(dir, "file.txt"))).toBeTrue();
    quickTemp.remake(obj, "tmpDir");
    expect(fs.existsSync(path.join(dir, "file.txt"))).toBeFalse();
    expect(fs.existsSync(obj.tmpDir)).toBeTrue();
  });

  it("remove deletes the directory and nulls property", () => {
    const dir = quickTemp.makeOrRemake(obj, "tmpDir", "MyClass");
    quickTemp.remove(obj, "tmpDir");
    expect(fs.existsSync(dir)).toBeFalse();
    expect(obj.tmpDir).toEqual(null);
  });
});
