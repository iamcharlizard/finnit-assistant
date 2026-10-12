import { extractText, getDocumentProxy } from 'unpdf';

/** Plain text of every page, joined with a form feed between pages. */
export async function extractPdfText(pdf: Buffer): Promise<string> {
  const document = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(document, { mergePages: false });
  return text.join('\n\f\n');
}

export function isPdf(file: Buffer): boolean {
  return file.subarray(0, 5).toString('ascii') === '%PDF-';
}
