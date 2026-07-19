// @vitest-environment jsdom

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { backupPathForResponse, snapshotBeforeWrite } from "./backupJournal";
import { findUnsafeDomPatchValues, findUnsafeMutationValues } from "./finiteMutation";
import { createPreviewAdapter } from "./previewAdapter";
import { getElementScreenshotClip } from "./screenshotClip";
import {
  patchElementInHtml,
  splitElementInHtml,
} from "./sourceMutation";
import { isSafePath, resolveWithinProject, walkDir } from "./safePath";
import { buildWaveformCacheKey, generateWaveformCache } from "./waveform";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe("studio-server helper mirror", () => {
  it("keeps project paths inside the project root and hides backup listings", () => {
    const projectDir = createTempDir("hf-studio-server-path-");
    const outsideDir = createTempDir("hf-studio-server-outside-");
    mkdirSync(join(projectDir, "assets"), { recursive: true });
    mkdirSync(join(projectDir, ".hyperframes", "backup"), { recursive: true });
    mkdirSync(join(projectDir, ".hyperframes", "examples"), { recursive: true });
    writeFileSync(join(projectDir, "index.html"), "ok");
    writeFileSync(join(projectDir, ".hyperframes", "backup", "snapshot.html"), "backup");
    writeFileSync(join(projectDir, ".hyperframes", "examples", "preset.html"), "preset");
    writeFileSync(join(outsideDir, "secret.txt"), "secret");
    symlinkSync(outsideDir, join(projectDir, "assets", "outside"));

    expect(isSafePath(projectDir, join(projectDir, "index.html"))).toBe(true);
    expect(resolveWithinProject(projectDir, "../escape.html")).toBeNull();
    expect(isSafePath(projectDir, join(projectDir, "assets", "outside", "secret.txt"))).toBe(
      false,
    );
    expect(walkDir(projectDir)).toContain(".hyperframes/examples/preset.html");
    expect(walkDir(projectDir)).not.toContain(".hyperframes/backup/snapshot.html");
  });

  it("rejects non-finite or lossy mutation values before JSON serialization", () => {
    expect(
      findUnsafeMutationValues({
        type: "set-arc-path",
        segments: [{ curviness: Number.NaN, cp1: { x: Infinity, y: 0 } }],
      }).map((field) => field.path),
    ).toEqual(["body.segments[0].curviness", "body.segments[0].cp1.x"]);

    expect(
      findUnsafeDomPatchValues({
        target: { id: "title", selectorIndex: null },
        operations: [{ type: "inline-style", property: "opacity", value: null }],
      }),
    ).toEqual([{ path: "body.target.selectorIndex", reason: "null" }]);
  });

  it("snapshots a file before write and returns a project-relative backup path", () => {
    const projectDir = createTempDir("hf-studio-server-backup-");
    mkdirSync(join(projectDir, "compositions"), { recursive: true });
    const file = join(projectDir, "compositions", "scene.html");
    writeFileSync(file, "before");

    const result = snapshotBeforeWrite(projectDir, file, { keepPerFile: 2 });
    writeFileSync(file, "after");

    expect(result.backupPath && existsSync(result.backupPath)).toBe(true);
    expect(readFileSync(result.backupPath!, "utf-8")).toBe("before");
    expect(backupPathForResponse(projectDir, result.backupPath)).toMatch(
      /^\.hyperframes\/backup\//,
    );
  });

  it("applies finite source mutations and preserves rollback input bytes", () => {
    const before = `<div id="hero" data-hf-id="hf-hero" style="color: red">Hello</div>`;

    const { html, matched } = patchElementInHtml(before, { hfId: "hf-hero" }, [
      { type: "inline-style", property: "color", value: "blue" },
      { type: "html-attribute", property: "href", value: "javascript:alert(1)" },
    ]);

    expect(matched).toBe(true);
    expect(html).toContain("color: blue");
    expect(html).not.toContain("javascript:");
    expect(before).toContain("color: red");
  });

  it("splits an element and duplicates simple id-targeted CSS rules", () => {
    const source = `<!doctype html><html><head><style>#box { color: red; }</style></head><body><div data-composition-id="root"><div id="box" class="clip" data-start="1" data-duration="6">Hello</div></div></body></html>`;

    const result = splitElementInHtml(source, { id: "box" }, 3, "box-split");

    expect(result.matched).toBe(true);
    expect(result.html).toContain('id="box-split"');
    expect(result.html).toContain("#box-split");
    expect(result.html).toContain("color: red");
  });

  it("adapts preview gestures and exposes clip timing", () => {
    document.body.innerHTML = `<div data-hf-root><div data-hf-id="hf-layer" data-start="1" data-duration="3" style="translate: 0px 0px"></div></div>`;
    const target = document.querySelector("[data-hf-id='hf-layer']") as HTMLElement;
    const adapter = createPreviewAdapter(document, { resolvePoint: () => target });

    expect(adapter.elementAtPoint(1, 1)).toBe(target);
    adapter.applyDraft({ type: "move", hfId: "hf-layer", dx: 12, dy: 8 });
    expect(target.getAttribute("data-hf-studio-manual-edit-gesture")).toBe("true");

    expect(adapter.commitPreview()).toEqual({
      type: "moveElement",
      hfId: "hf-layer",
      dx: 12,
      dy: 8,
    });
    expect(adapter.getElementTimings()["hf-layer"]).toEqual({ start: 1, end: 4 });
  });

  it("computes screenshot clips and waveform cache keys without spawning work", async () => {
    document.body.innerHTML = `<div id="clip"></div>`;
    const clip = document.getElementById("clip") as HTMLElement;
    Object.defineProperty(clip, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 20,
        top: 30,
        width: 50,
        height: 40,
        right: 70,
        bottom: 70,
      }),
    });

    expect(getElementScreenshotClip("#clip")).toMatchObject({
      x: 12,
      y: 22,
      width: 66,
      height: 56,
    });
    expect(getElementScreenshotClip("#0")).toBeUndefined();

    const projectDir = createTempDir("hf-studio-server-waveform-");
    await expect(generateWaveformCache(projectDir, "missing/audio.wav")).resolves.toBeUndefined();
    expect(buildWaveformCacheKey("media/audio\\voice.wav")).toBe(
      "v2_media_audio_voice.wav.json",
    );
  });
});
