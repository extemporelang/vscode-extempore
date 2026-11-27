// Installing an Extempore release, where the install scripts
// (extemporelang.github.io/install.sh and install.ps1) put it, so that the
// extension finds an Extempore whichever of them installed it:
//
//   <root>/VERSION/      the release's tree (bin/, share/extempore/, lib/extempore/)
//   <root>/current       a link to the version in use
//
// <root> is ~/.local/share/extempore (or $XDG_DATA_HOME/extempore) on macOS and
// Linux, and %LOCALAPPDATA%\Programs\Extempore on Windows.

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as vscode from "vscode";
import * as yauzl from "yauzl";

export function installRoot(
  platform: string = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  if (platform === "win32") {
    const local = env["LOCALAPPDATA"] || path.join(home, "AppData", "Local");
    return path.join(local, "Programs", "Extempore");
  }
  return path.join(env["XDG_DATA_HOME"] || path.join(home, ".local", "share"), "extempore");
}

export function installedBinDir(): string {
  return path.join(installRoot(), "current", "bin");
}

// The installed extempore, if there is one.
export function installedExecutable(): string | undefined {
  const exe = path.join(
    installedBinDir(),
    process.platform === "win32" ? "extempore.exe" : "extempore",
  );
  return fs.existsSync(exe) ? exe : undefined;
}

// The share directory (runtime/, libs/, examples/) of the extempore `exe`
// names, if it's a path: share/extempore in the tree it's installed in, or the
// folder it sits in for a release before v0.13.0.
export function shareDirOf(exe: string): string | undefined {
  if (!path.isAbsolute(exe)) {
    return undefined;
  }
  let real: string;
  try {
    real = fs.realpathSync(exe);
  } catch {
    return undefined;
  }
  const candidates = [
    path.join(path.dirname(path.dirname(real)), "share", "extempore"),
    path.dirname(real),
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "runtime", "init.xtm")));
}

export interface ReleaseArchive {
  archive: string;
  sha256: string;
  version: string;
}

// The archive for this platform in a release's SHA256SUMS, or undefined if it
// has none. Windows on Arm runs the x86_64 release under emulation.
export function releaseArchive(
  sums: string,
  platform: string,
  arch: string,
): ReleaseArchive | undefined {
  const system = { linux: "linux", darwin: "macos", win32: "windows" }[platform];
  const machine = platform === "win32" ? "x86_64" : { x64: "x86_64", arm64: "aarch64" }[arch];
  if (!system || !machine) {
    return undefined;
  }
  const prefix = `extempore-${system}-${machine}-`;
  for (const line of sums.split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64}) +\*?(\S+\.zip)$/.exec(line.trim());
    if (match?.[1] && match[2]?.startsWith(prefix)) {
      return {
        archive: match[2],
        sha256: match[1].toLowerCase(),
        version: match[2].slice(prefix.length, -4),
      };
    }
  }
  return undefined;
}

// Where releases are: the latest one's assets, or $EXTEMPORE_DOWNLOAD_URL (for
// testing, as with the install scripts).
export function releaseBase(): string {
  return (
    process.env["EXTEMPORE_DOWNLOAD_URL"] ||
    "https://github.com/digego/extempore/releases/latest/download"
  );
}

// Downloads and installs the latest release, after asking. Resolves to the
// installed extempore, or undefined if it wasn't installed.
export async function installExtempore(): Promise<string | undefined> {
  const base = releaseBase();
  const sumsResponse = await fetch(`${base}/SHA256SUMS`);
  if (!sumsResponse.ok) {
    void vscode.window.showErrorMessage(
      `Extempore: couldn't find the latest release (HTTP ${sumsResponse.status} for its SHA256SUMS)`,
    );
    return undefined;
  }
  const release = releaseArchive(await sumsResponse.text(), process.platform, process.arch);
  if (!release) {
    void vscode.window.showErrorMessage(
      `Extempore: the latest release has no download for ${process.platform} ${process.arch}`,
    );
    return undefined;
  }
  const url = `${base}/${release.archive}`;
  const head = await fetch(url, { method: "HEAD" });
  const megabytes = Math.round(Number(head.headers.get("content-length") ?? 0) / 1e6);
  const root = installRoot();
  const dest = path.join(root, release.version);
  const again = fs.existsSync(dest) ? "Reinstall" : "Install";
  const ok = await vscode.window.showInformationMessage(
    `${again} Extempore ${release.version}?`,
    {
      modal: true,
      detail: `It's a ${megabytes} MB download, and it goes in ${dest}.`,
    },
    again,
  );
  if (ok !== again) {
    return undefined;
  }
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Installing Extempore ${release.version}`,
      },
      (progress) =>
        installRelease(url, release, root, (fraction) =>
          progress.report({ increment: fraction * 100 }),
        ),
    );
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Extempore: the install failed (${error instanceof Error ? error.message : error})`,
    );
    return undefined;
  }
  return installedExecutable();
}

// Downloads the archive at url, checks it, unpacks it into root/VERSION and
// points root/current at it.
export async function installRelease(
  url: string,
  release: ReleaseArchive,
  root: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  await fs.promises.mkdir(root, { recursive: true });
  // in root, so that the tree moves into place with a rename
  const tmp = await fs.promises.mkdtemp(path.join(root, ".install-"));
  try {
    const zipPath = path.join(tmp, release.archive);
    const sha256 = await download(url, zipPath, onProgress);
    if (sha256 !== release.sha256) {
      throw new Error(`${release.archive} doesn't match its checksum in SHA256SUMS`);
    }
    const unpacked = path.join(tmp, "unpacked");
    await extractZip(zipPath, unpacked);
    const tree = path.join(unpacked, release.archive.slice(0, -4));
    const exe = path.join(
      tree,
      "bin",
      process.platform === "win32" ? "extempore.exe" : "extempore",
    );
    if (!fs.existsSync(exe)) {
      throw new Error(`${release.archive} doesn't hold ${path.relative(tree, exe)}`);
    }
    const dest = path.join(root, release.version);
    await fs.promises.rm(dest, { recursive: true, force: true });
    await fs.promises.rename(tree, dest);
    await pointCurrentAt(root, release.version);
    if (process.platform !== "win32" && root === installRoot()) {
      await linkIntoBinDir(path.join(root, "current", "bin", "extempore"));
    }
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true });
  }
}

// <root>/current: a symlink to VERSION, or on Windows a junction, which needs
// no administrator rights.
async function pointCurrentAt(root: string, version: string): Promise<void> {
  const current = path.join(root, "current");
  try {
    await fs.promises.lstat(current);
    // removes the link, and leaves the version it points at
    await (process.platform === "win32" ? fs.promises.rmdir(current) : fs.promises.unlink(current));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  if (process.platform === "win32") {
    await fs.promises.symlink(path.join(root, version), current, "junction");
  } else {
    await fs.promises.symlink(version, current);
  }
}

// ~/.local/bin/extempore (or $XDG_BIN_HOME/extempore) as install.sh makes it,
// unless something other than a link is there already.
async function linkIntoBinDir(target: string): Promise<void> {
  const bindir = process.env["XDG_BIN_HOME"] || path.join(os.homedir(), ".local", "bin");
  const link = path.join(bindir, "extempore");
  try {
    if (!(await fs.promises.lstat(link)).isSymbolicLink()) {
      return;
    }
    await fs.promises.unlink(link);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  await fs.promises.mkdir(bindir, { recursive: true });
  await fs.promises.symlink(target, link);
}

// Downloads url to dest, reporting each chunk's share of the whole, and
// resolves to its SHA-256.
async function download(
  url: string,
  dest: string,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30 * 60 * 1000) });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  const total = Number(response.headers.get("content-length")) || 0;
  const hash = crypto.createHash("sha256");
  const body = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
  body.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    if (total) {
      onProgress(chunk.length / total);
    }
  });
  await pipeline(body, fs.createWriteStream(dest));
  return hash.digest("hex");
}

// Unpacks a zip, failing on any entry which would land outside destDir.
function extractZip(zipPath: string, destDir: string): Promise<void> {
  const root = path.resolve(destDir);
  const inside = (p: string) => p === root || p.startsWith(root + path.sep);
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        return reject(err ?? new Error("couldn't open the zip"));
      }
      const fail = (e: Error) => {
        zipfile.close();
        reject(e);
      };
      zipfile.on("error", fail);
      zipfile.on("end", () => resolve());
      zipfile.on("entry", async (entry: yauzl.Entry) => {
        try {
          const target = path.resolve(root, entry.fileName);
          if (!inside(target)) {
            throw new Error(`unsafe path in zip: ${entry.fileName}`);
          }
          const mode = (entry.externalFileAttributes >>> 16) & 0o177777;
          const isSymlink = (mode & 0o170000) === 0o120000;
          if (entry.fileName.endsWith("/")) {
            await fs.promises.mkdir(target, { recursive: true });
          } else {
            await fs.promises.mkdir(path.dirname(target), { recursive: true });
            const stream = await new Promise<Readable>((res, rej) =>
              zipfile.openReadStream(entry, (e, s) => (e || !s ? rej(e) : res(s))),
            );
            if (isSymlink) {
              const linkTarget = (await streamToBuffer(stream)).toString();
              if (!inside(path.resolve(path.dirname(target), linkTarget))) {
                throw new Error(`unsafe symlink in zip: ${entry.fileName} -> ${linkTarget}`);
              }
              await fs.promises.symlink(linkTarget, target);
            } else {
              await pipeline(stream, fs.createWriteStream(target, { mode: mode & 0o777 || 0o644 }));
            }
          }
          zipfile.readEntry();
        } catch (e) {
          fail(e as Error);
        }
      });
      zipfile.readEntry();
    });
  });
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
