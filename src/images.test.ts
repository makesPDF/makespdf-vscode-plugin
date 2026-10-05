import { test } from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, open, rm, writeFile } from "node:fs/promises";
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

test("a reference to a directory is reported as unreadable, not too-large", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, "images.png"));
    const { markdown, failures } = await inlineLocalImages("![d](images.png)\n", dir);
    assert.equal(markdown, "![d](images.png)\n");
    assert.deepEqual(failures, [{ src: "images.png", reason: "unreadable" }]);
  });
});

test("data-src is not mistaken for the img src attribute", async () => {
  await withTempDir(async (dir) => {
    // A lazy-loading placeholder pointing at a missing file must not stop an
    // export whose real src is a remote URL the service can fetch.
    const source = '<img data-src="missing.png" src="https://example.com/x.png">\n';
    const { markdown, failures } = await inlineLocalImages(source, dir);
    assert.deepEqual(failures, []);
    assert.equal(markdown, source);
  });
});

test("an img with a slash before src still embeds it", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "diagram.png"), PNG);
    for (const source of [
      '<img/src="diagram.png">\n',
      '<img alt="x"/src="diagram.png">\n',
    ]) {
      const { markdown, failures } = await inlineLocalImages(source, dir);
      assert.deepEqual(failures, [], source);
      assert.ok(markdown.includes(PNG_DATA_URI), source);
    }
  });
});

test("a readable data-src target is left alone, not embedded", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "local.png"), PNG);
    const source = '<img data-src="local.png" src="https://example.com/x.png">\n';
    const { markdown, failures } = await inlineLocalImages(source, dir);
    assert.deepEqual(failures, []);
    assert.equal(markdown, source, "the placeholder's value is not rewritten");
  });
});

test("failures across markdown and HTML references keep document order", async () => {
  await withTempDir(async (dir) => {
    const source = '<img src="html-missing.png">\n\n![md](md-missing.png)\n';
    const { failures } = await inlineLocalImages(source, dir);
    assert.deepEqual(failures, [
      { src: "html-missing.png", reason: "unreadable" },
      { src: "md-missing.png", reason: "unreadable" },
    ]);
  });
});

test("image-like text inside code spans and fences is left verbatim", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "diagram.png"), PNG);
    const source =
      "`![a](diagram.png)`\n\n```\n![b](diagram.png)\n```\n\n![c](diagram.png)\n";
    const { markdown, failures } = await inlineLocalImages(source, dir);
    assert.deepEqual(failures, []);
    assert.equal(
      markdown,
      "`![a](diagram.png)`\n\n```\n![b](diagram.png)\n```\n\n" +
        `![c](${PNG_DATA_URI})\n`,
      "code spans and fences are restored untouched",
    );
  });
});

test("document text that looks like a mask sentinel survives the round-trip", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "diagram.png"), PNG);
    // NUL-delimited sentinels cannot collide with real text; a document that
    // literally contains ` CODE0 ` must not be restored into the masked span.
    // The second, un-masked image makes `restore` actually run.
    const source =
      "`![a](diagram.png)` and a literal  CODE0  token\n\n![c](diagram.png)\n";
    const { markdown, failures } = await inlineLocalImages(source, dir);
    assert.deepEqual(failures, []);
    assert.equal(
      markdown,
      "`![a](diagram.png)` and a literal  CODE0  token\n\n" +
        `![c](${PNG_DATA_URI})\n`,
    );
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

test("an unreadable over-5MB file is too-large, proving size is checked before reading", async () => {
  await withTempDir(async (dir) => {
    // `stat` sees the size and no bytes are read; a read-first implementation
    // would hit EACCES and report `unreadable`.
    const path = join(dir, "locked.png");
    await sparseFile(path, MAX_IMAGE_BYTES + 1);
    await chmod(path, 0o000);
    try {
      const { failures } = await inlineLocalImages("![locked](locked.png)\n", dir);
      assert.deepEqual(failures, [{ src: "locked.png", reason: "too-large" }]);
    } finally {
      await chmod(path, 0o600);
    }
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
