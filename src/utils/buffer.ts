/** Search for an ASCII needle in the first `maxLen` bytes without stringifying the whole ROM. */
export function indexOfAscii(
  buf: Buffer,
  needle: string,
  maxLen = buf.length
): number {
  const n = Buffer.from(needle, "ascii");
  const end = Math.min(buf.length, maxLen);
  if (n.length === 0 || end < n.length) return -1;
  return buf.subarray(0, end).indexOf(n);
}

export function hasAscii(
  buf: Buffer,
  needle: string,
  maxLen = buf.length
): boolean {
  return indexOfAscii(buf, needle, maxLen) !== -1;
}

/** True if every byte in range is printable ASCII or space (0x20–0x7E). */
export function isPrintableAscii(buf: Buffer, start: number, end: number): boolean {
  if (end > buf.length || start < 0 || end <= start) return false;
  for (let i = start; i < end; i++) {
    const c = buf[i];
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

export function readAscii(
  buf: Buffer,
  start: number,
  end: number,
  stripNulls = true
): string {
  if (end > buf.length || start < 0) return "";
  let s = buf.subarray(start, end).toString("ascii");
  if (stripNulls) s = s.replace(/\0/g, "");
  return s.trim();
}
