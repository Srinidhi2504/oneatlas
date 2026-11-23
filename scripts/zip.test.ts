// Tests for the ZIP writer: entries are read back through the central directory, inflated and CRC-checked.
import { inflateRawSync, crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createZip } from "./zip";

/** Read a zip back through its central directory, the way unzip tools do. */
function readZip(zip: Buffer) {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let p = zip.readUInt32LE(end + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const method = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const start = local + 30 + zip.readUInt16LE(local + 26);
    const body = zip.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(body) : body;
    expect(crc32(data)).toBe(crc);
    out[name] = data.toString("utf8");
    p += 46 + nameLen;
  }
  return out;
}

describe("createZip", () => {
  it("round-trips deflated and stored entries with correct CRCs and UTF-8 names", () => {
    const big = "export const x = 1;\n".repeat(200); // compressible: deflated
    const tiny = "a"; // deflate would grow it: stored
    const zip = createZip([
      { path: "oneatlas/src/big.ts", data: Buffer.from(big) },
      { path: "oneatlas/tiny.txt", data: Buffer.from(tiny) },
      { path: "oneatlas/docs/naïve.md", data: Buffer.from("é") },
    ]);
    expect(readZip(zip)).toEqual({ "oneatlas/src/big.ts": big, "oneatlas/tiny.txt": tiny, "oneatlas/docs/naïve.md": "é" });
    expect(zip.length).toBeLessThan(big.length); // compression actually happened
  });

  it("writes a valid empty archive", () => {
    expect(readZip(createZip([]))).toEqual({});
  });
});
