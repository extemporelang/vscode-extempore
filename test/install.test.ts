import * as assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { installRelease, installRoot, releaseArchive, releaseBase, shareDirOf } from "../src/install";

const sums = [
  `${"a".repeat(64)}  extempore-linux-aarch64-v0.13.0.zip`,
  `${"b".repeat(64)}  extempore-linux-x86_64-v0.13.0.zip`,
  `${"C".repeat(64)} *extempore-macos-aarch64-v0.13.0.zip`,
  `${"d".repeat(64)}  extempore-windows-x86_64-v0.13.0.zip`,
  "",
].join("\n");

suite("installing", () => {
  test("the archive for each platform comes from SHA256SUMS", () => {
    assert.deepEqual(releaseArchive(sums, "linux", "x64"), {
      archive: "extempore-linux-x86_64-v0.13.0.zip",
      sha256: "b".repeat(64),
      version: "v0.13.0",
    });
    assert.equal(releaseArchive(sums, "linux", "arm64")?.sha256, "a".repeat(64));
    // shasum's binary-mode marker, and an upper-case hash
    assert.equal(releaseArchive(sums, "darwin", "arm64")?.sha256, "c".repeat(64));
    // Windows on Arm runs the x86_64 release
    assert.equal(
      releaseArchive(sums, "win32", "arm64")?.archive,
      "extempore-windows-x86_64-v0.13.0.zip",
    );
    assert.equal(releaseArchive(sums, "darwin", "x64"), undefined);
    assert.equal(releaseArchive(sums, "freebsd", "x64"), undefined);
  });

  test("it goes where the install scripts put it", () => {
    assert.equal(
      installRoot("linux", {}, "/home/u"),
      path.join("/home/u", ".local", "share", "extempore"),
    );
    assert.equal(
      installRoot("darwin", { XDG_DATA_HOME: "/data" }, "/Users/u"),
      path.join("/data", "extempore"),
    );
    assert.equal(
      installRoot("win32", { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" }, "C:\\Users\\u"),
      path.join("C:\\Users\\u\\AppData\\Local", "Programs", "Extempore"),
    );
  });

  test("the share folder is found from the binary, in either layout", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xtm-install-test-"));
    try {
      const tree = (dir: string, exeDir: string) => {
        fs.mkdirSync(path.join(dir, "runtime"), { recursive: true });
        fs.writeFileSync(path.join(dir, "runtime", "init.xtm"), "");
        fs.mkdirSync(exeDir, { recursive: true });
        fs.writeFileSync(path.join(exeDir, "extempore"), "");
        return path.join(exeDir, "extempore");
      };
      const installed = path.join(tmp, "v0.13.0");
      const share = path.join(installed, "share", "extempore");
      assert.equal(shareDirOf(tree(share, path.join(installed, "bin"))), fs.realpathSync(share));
      const flat = path.join(tmp, "extempore-macos-aarch64-v0.12.1");
      assert.equal(shareDirOf(tree(flat, flat)), fs.realpathSync(flat));
      assert.equal(shareDirOf("extempore"), undefined);
      assert.equal(shareDirOf(path.join(tmp, "nothing", "extempore")), undefined);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  // $EXTEMPORE_TEST_INSTALL: download the latest release (a few hundred MB)
  // and install it into a temporary root, twice, as an upgrade would
  test("the latest release installs, and installs again over itself", async function () {
    if (!process.env["EXTEMPORE_TEST_INSTALL"]) {
      this.skip();
    }
    this.timeout(30 * 60 * 1000);
    const sums = await (await fetch(`${releaseBase()}/SHA256SUMS`)).text();
    const release = releaseArchive(sums, process.platform, process.arch);
    assert.ok(release, "the latest release has an archive for this platform");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "xtm-install-"));
    const exe = path.join(root, "current", "bin", process.platform === "win32" ? "extempore.exe" : "extempore");
    try {
      for (const _ of [1, 2]) {
        await installRelease(`${releaseBase()}/${release.archive}`, release, root, () => {});
        const out = execFileSync(exe, ["exec", "-e", "(println (sys:share-dir))"], { encoding: "utf8" });
        assert.match(out, /share.extempore/);
        assert.equal(shareDirOf(exe), fs.realpathSync(path.join(root, release.version, "share", "extempore")));
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
