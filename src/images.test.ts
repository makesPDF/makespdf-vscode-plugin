import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatImageFailure,
  inlineLocalImages,
  MAX_IMAGE_BYTES,
  prepareExportMarkdown,
  type ImageFailure,
} from "./images.ts";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7, 7]);
const PNG_DATA_URI = `data:image/png;base64,${PNG.toString("base64")}`;

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "makespdf-images-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Create a sparse file whose reported size is `size` without writing bytes. */
async function sparseFile(path: string, size: number): Promise<void> {
  const handle = await open(path, "w");
  try {
    await handle.truncate(size);
  } finally {
    await handle.close();
  }
}

test("formatImageFailure is null with no failures", () => {
  assert.equal(formatImageFailure([]), null);
});

test("formatImageFailure singular names the reference, reason and fix", () => {
  assert.equal(
    formatImageFailure([{ src: "missing.png", reason: "unreadable" }]),
    "Export stopped, no PDF was written: 1 local image could not be embedded: " +
      "missing.png (could not be read). Fix or remove the reference and export again.",
  );
});

test("formatImageFailure plural carries each mixed reason", () => {
  assert.equal(
    formatImageFailure([
      { src: "missing.png", reason: "unreadable" },
      { src: "big.png", reason: "too-large" },
    ]),
    "Export stopped, no PDF was written: 2 local images could not be embedded: " +
      "missing.png (could not be read), big.png (too large to embed, max 5MB). " +
      "Fix or remove these references and export again.",
  );
});

test("formatImageFailure lists ten, then counts the rest", () => {
  const many: ImageFailure[] = Array.from({ length: 12 }, (_, i) => ({
    src: `${i}.png`,
    reason: "unreadable",
  }));
  const message = formatImageFailure(many)!;
  assert.match(message, /^Export stopped, no PDF was written: 12 local images/);
  assert.match(message, /9\.png \(could not be read\) and 2 more\./);
  assert.ok(!message.includes("10.png"), "names past the tenth are counted, not listed");
});

test("a missing local image is reported while readable ones still inline", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "diagram.png"), PNG);
    const { markdown, failures } = await inlineLocalImages(
      "# Diagram\n\n![diagram](diagram.png)\n\n![gone](missing.png)\n",
      dir,
    );
    assert.equal(
      markdown,
      `# Diagram\n\n![diagram](${PNG_DATA_URI})\n\n![gone](missing.png)\n`,
    );
    assert.deepEqual(failures, [{ src: "missing.png", reason: "unreadable" }]);
  });
});

test("an unreadable directory reference is reported as unreadable", async () => {
  await withTempDir(async (dir) => {
    const { markdown, failures } = await inlineLocalImages("![d](images.png)\n", dir);
    assert.equal(markdown, "![d](images.png)\n");
    assert.deepEqual(failures, [{ src: "images.png", reason: "unreadable" }]);
  });
});

test("an image over the 5MB limit is too-large and its bytes are never read", async () => {
  await withTempDir(async (dir) => {
    await sparseFile(join(dir, "big.png"), MAX_IMAGE_BYTES + 1);
    const { markdown, failures } = await inlineLocalImages("![big](big.png)\n", dir);
    assert.equal(markdown, "![big](big.png)\n");
    assert.deepEqual(failures, [{ src: "big.png", reason: "too-large" }]);
  });
});

test("an image exactly at the 5MB limit is embedded", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "limit.png");
    await sparseFile(path, MAX_IMAGE_BYTES);
    const { markdown, failures } = await inlineLocalImages("![big](limit.png)\n", dir);
    assert.deepEqual(failures, []);
    assert.match(markdown, new RegExp(`^!\\[big\\]\\(data:image/png;base64,`));
  });
});

test("prepareExportMarkdown stops when any local image cannot be embedded", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "diagram.png"), PNG);
    const prepared = await prepareExportMarkdown(
      "# Diagram\n\n![diagram](diagram.png)\n\n![gone](missing.png)\n",
      dir,
    );
    assert.equal(
      prepared.error,
      "Export stopped, no PDF was written: 1 local image could not be embedded: " +
        "missing.png (could not be read). Fix or remove the reference and export again.",
    );
  });
});

test("prepareExportMarkdown has no error when every local image embeds", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "diagram.png"), PNG);
    const prepared = await prepareExportMarkdown("![diagram](diagram.png)\n", dir);
    assert.equal(prepared.error, null);
    assert.equal(prepared.markdown, `![diagram](${PNG_DATA_URI})\n`);
  });
});
