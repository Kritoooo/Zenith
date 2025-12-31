/// <reference lib="webworker" />

export {};

type ZipEntry = {
  name: string;
  data: Uint8Array;
  isDirectory?: boolean;
  modified?: number | null;
};

type ZipRunMessage = {
  type: "zip";
  id: number;
  entries: ZipEntry[];
};

type ZipProgressMessage = {
  type: "progress";
  id: number;
  completed: number;
  total: number;
};

type ZipResultMessage = {
  type: "result";
  id: number;
  buffer: ArrayBuffer;
};

type ZipErrorMessage = {
  type: "error";
  id: number;
  message: string;
};

type IncomingMessage = ZipRunMessage;

const textEncoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let k = 0; k < 8; k += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16LE = (buffer: Uint8Array, offset: number, value: number) => {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32LE = (buffer: Uint8Array, offset: number, value: number) => {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
};

const toDosDateTime = (timestamp?: number | null) => {
  const date = timestamp ? new Date(timestamp) : new Date();
  const safeDate = date.getFullYear() < 1980 ? new Date(1980, 0, 1) : date;
  const year = safeDate.getFullYear() - 1980;
  const month = safeDate.getMonth() + 1;
  const day = safeDate.getDate();
  const hours = safeDate.getHours();
  const minutes = safeDate.getMinutes();
  const seconds = Math.floor(safeDate.getSeconds() / 2);
  const dosDate = (year << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  return { dosDate, dosTime };
};

const buildZipBuffer = (entries: ZipEntry[], runId: number) => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const total = entries.length;

  entries.forEach((entry, index) => {
    const name = entry.isDirectory && !entry.name.endsWith("/")
      ? `${entry.name}/`
      : entry.name;
    const nameBytes = textEncoder.encode(name);
    const data = entry.data;
    const size = data.length;
    const crc = crc32(data);
    const { dosDate, dosTime } = toDosDateTime(entry.modified);

    const localHeader = new Uint8Array(30);
    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20);
    writeUint16LE(localHeader, 6, 0x0800);
    writeUint16LE(localHeader, 8, 0);
    writeUint16LE(localHeader, 10, dosTime);
    writeUint16LE(localHeader, 12, dosDate);
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(localHeader, 18, size);
    writeUint32LE(localHeader, 22, size);
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0);

    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array(46);
    writeUint32LE(centralHeader, 0, 0x02014b50);
    writeUint16LE(centralHeader, 4, 20);
    writeUint16LE(centralHeader, 6, 20);
    writeUint16LE(centralHeader, 8, 0x0800);
    writeUint16LE(centralHeader, 10, 0);
    writeUint16LE(centralHeader, 12, dosTime);
    writeUint16LE(centralHeader, 14, dosDate);
    writeUint32LE(centralHeader, 16, crc);
    writeUint32LE(centralHeader, 20, size);
    writeUint32LE(centralHeader, 24, size);
    writeUint16LE(centralHeader, 28, nameBytes.length);
    writeUint16LE(centralHeader, 30, 0);
    writeUint16LE(centralHeader, 32, 0);
    writeUint16LE(centralHeader, 34, 0);
    writeUint16LE(centralHeader, 36, 0);
    writeUint32LE(centralHeader, 38, entry.isDirectory ? 0x10 : 0);
    writeUint32LE(centralHeader, 42, offset);

    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + data.length;

    const shouldUpdate = index === total - 1 || index % 25 === 0;
    if (shouldUpdate) {
      const progress: ZipProgressMessage = {
        type: "progress",
        id: runId,
        completed: index + 1,
        total,
      };
      postMessage(progress);
    }
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  writeUint32LE(endRecord, 0, 0x06054b50);
  writeUint16LE(endRecord, 4, 0);
  writeUint16LE(endRecord, 6, 0);
  writeUint16LE(endRecord, 8, entries.length);
  writeUint16LE(endRecord, 10, entries.length);
  writeUint32LE(endRecord, 12, centralSize);
  writeUint32LE(endRecord, 16, centralOffset);
  writeUint16LE(endRecord, 20, 0);

  const parts = [...localParts, ...centralParts, endRecord];
  const totalSize = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalSize);
  let cursor = 0;
  parts.forEach((part) => {
    output.set(part, cursor);
    cursor += part.length;
  });

  return output.buffer;
};

const formatErrorMessage = (err: unknown) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage) return maybeMessage;
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown worker error.";
    }
  }
  return "Unknown worker error.";
};

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
  const data = event.data;
  if (!data || data.type !== "zip") return;
  try {
    const buffer = buildZipBuffer(data.entries, data.id);
    const result: ZipResultMessage = { type: "result", id: data.id, buffer };
    postMessage(result, [buffer]);
  } catch (err) {
    const error: ZipErrorMessage = {
      type: "error",
      id: data.id,
      message: formatErrorMessage(err),
    };
    postMessage(error);
  }
};
