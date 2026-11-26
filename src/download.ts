// Downloading an extempore release from GitHub and unpacking it.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as vscode from "vscode";
import * as yauzl from "yauzl";

const latestRelease = "https://api.github.com/repos/digego/extempore/releases/latest";

// The archive a release has for this platform, named as the release workflow
// names it (e.g. extempore-linux-x86_64-v0.11.2), or undefined if it has none.
export function releaseArchive(platform: string, arch: string, tag: string): string | undefined {
  const system = { linux: "linux", darwin: "macos", win32: "windows" }[platform];
  const machine = { x64: "x86_64", arm64: "aarch64" }[arch];
  return system && machine ? `extempore-${system}-${machine}-${tag}` : undefined;
}

interface Release {
  tag_name: string;
  assets: { name: string; size: number; browser_download_url: string }[];
}

export async function downloadExtempore(): Promise<void> {
  const response = await fetch(latestRelease, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    void vscode.window.showErrorMessage(
      `Extempore: couldn't find the latest release (HTTP ${response.status})`,
    );
    return;
  }
  const release = (await response.json()) as Release;
  const archive = releaseArchive(process.platform, process.arch, release.tag_name);
  const asset = release.assets.find((a) => a.name === `${archive}.zip`);
  if (!archive || !asset) {
    void vscode.window.showErrorMessage(
      `Extempore: release ${release.tag_name} has no download for ${process.platform} ${process.arch}`,
    );
    return;
  }
  const megabytes = Math.round(asset.size / 1e6);
  const ok = await vscode.window.showWarningMessage(
    `Download Extempore ${release.tag_name} (${megabytes} MB)?`,
    { modal: true },
    "Download",
  );
  if (ok !== "Download") {
    return;
  }
  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    openLabel: "Download here",
  });
  const into = folders?.[0]?.fsPath;
  if (!into) {
    return;
  }
  const sharedir = path.join(into, archive);
  if (fs.existsSync(sharedir)) {
    void vscode.window.showErrorMessage(`Extempore: ${sharedir} already exists`);
    return;
  }
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Downloading Extempore ${release.tag_name}`,
      },
      (progress) =>
        downloadAndExtract(asset.browser_download_url, into, (fraction) =>
          progress.report({ increment: fraction * 100 }),
        ),
    );
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Extempore: the download failed (${error instanceof Error ? error.message : error})`,
    );
    return;
  }
  const config = vscode.workspace.getConfiguration("extempore");
  const executable = path.join(
    sharedir,
    process.platform === "win32" ? "extempore.exe" : "extempore",
  );
  await config.update("sharedir", sharedir, vscode.ConfigurationTarget.Global);
  await config.update("executable", executable, vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(
    `Extempore: ${release.tag_name} is in ${sharedir}, and extempore.sharedir and extempore.executable point at it`,
  );
}

// Downloads a zip to a temporary file, reporting each chunk's share of the
// whole, then unpacks it into destDir.
async function downloadAndExtract(
  url: string,
  destDir: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  const total = Number(response.headers.get("content-length")) || 0;
  const body = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
  body.on("data", (chunk: Buffer) => {
    if (total) {
      onProgress(chunk.length / total);
    }
  });
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "extempore-"));
  const zipPath = path.join(tmpDir, "extempore.zip");
  try {
    await pipeline(body, fs.createWriteStream(zipPath));
    await extractZip(zipPath, destDir);
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
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
