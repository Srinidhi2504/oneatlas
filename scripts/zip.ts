// Minimal ZIP writer (deflate, no ZIP64) on Node's built-in zlib, so the source download needs no dependency.
// Format reference: PKWARE APPNOTE 6.3 (local file header, central directory, end of central directory record).
// ponytail: fine for a few hundred files / a few MB; past 65,535 entries or 4 GB this would need ZIP64.
import { crc32, deflateRawSync } from "node:zlib";

export interface ZipEntry {
  path: string; // forward slashes, no leading slash
  data: Uint8Array;
}

/** MS-DOS date/time, the timestamp format ZIP headers use (2-second resolution, local time). */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Build a .zip archive in memory. Entries are deflated unless that makes them bigger (then stored). */
export function createZip(entries: ZipEntry[], modified = new Date()): Buffer {
  const { time, date } = dosDateTime(modified);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const raw = Buffer.from(entry.data);
    const deflated = deflateRawSync(raw, { level: 9 });
    const useDeflate = deflated.length < raw.length;
    const body = useDeflate ? deflated : raw;
    const crc = crc32(raw);

    // local file header (30 bytes + name)
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed: 2.0
    local.writeUInt16LE(0x0800, 6); // flags: bit 11 = file names are UTF-8
    local.writeUInt16LE(useDeflate ? 8 : 0, 8); // method: 8 deflate, 0 stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); // compressed size
    local.writeUInt32LE(raw.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    locals.push(local, name, body);

    // central directory record (46 bytes + name), points back at the local header
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4); // made by: UNIX, spec 3.0 (keeps the permission bits below meaningful)
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    // 30 extra len, 32 comment len, 34 disk number, 36 internal attrs: all 0
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs: regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }

  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8); // entries on this disk
  end.writeUInt16LE(entries.length, 10); // entries total
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16); // where the central directory starts
  return Buffer.concat([...locals, ...centrals, end]);
}
