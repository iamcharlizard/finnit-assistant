export interface DetectedFileType {
  mime: string;
  extension: string;
}

/**
 * Detects the type from the file's first bytes, never from the name or the
 * Content-Type the client sends (both can lie). Only types we accept are
 * recognized.
 */
export function detectFileType(file: Buffer): DetectedFileType | null {
  const head = file.subarray(0, 16);
  const ascii = head.toString('latin1');

  if (ascii.startsWith('%PDF-'))
    return { mime: 'application/pdf', extension: 'pdf' };
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (
    head
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  // ISO-BMFF "ftyp" box with a HEIC/HEIF brand (iPhone photos).
  if (
    ascii.slice(4, 8) === 'ftyp' &&
    /^(heic|heix|heim|heis|mif1|msf1)$/.test(ascii.slice(8, 12))
  ) {
    return { mime: 'image/heic', extension: 'heic' };
  }
  return null;
}

/** File name safe to store and to send back in Content-Disposition. */
export function safeFileName(
  name: string | undefined,
  fallback: string,
): string {
  const base = (name ?? '')
    .split(/[\\/]/)
    .pop()!
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return base || fallback;
}
