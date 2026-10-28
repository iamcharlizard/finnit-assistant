import { Injectable, Logger } from '@nestjs/common';

/** A text line found by the OCR service, in reading order. */
export interface OcrLine {
  text: string;
  /** 0–1 */
  confidence: number;
  /** Four [x, y] corners, in pixels of the processed image. */
  box: number[][];
}

/** A QR or barcode decoded from the image (e.g. the SAT QR of a CFDI). */
export interface OcrCode {
  text: string;
  format: string;
}

export interface OcrImageResult {
  width: number;
  height: number;
  lines: OcrLine[];
  qr: OcrCode[];
  timingsMs?: Record<string, number>;
}

export interface OcrPdfPage {
  page: number;
  width: number;
  height: number;
  lines: OcrLine[];
  qr: OcrCode[];
}

export interface OcrPdfResult {
  pages: OcrPdfPage[];
  timingsMs?: Record<string, number>;
}

/** Base class: the document could not be read by the OCR service. */
export class OcrError extends Error {}

/**
 * The service is not configured, unreachable, timed out, failed (5xx) or
 * rejected our token. Callers fall back (AI) or fail with a clear message.
 */
export class OcrUnavailableError extends OcrError {}

/** The service refused this file (400 / 413 too large / 415 unsupported). */
export class OcrRejectedError extends OcrError {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const OCR_TIMEOUT_MS = 30_000;
/**
 * PDFs are rasterized and read page by page, so they get more time: longer
 * than the OCR service's own limit (OCR_PDF_TIMEOUT_SECONDS, 300 s) so the
 * service answers first.
 */
export const OCR_PDF_TIMEOUT_MS = 330_000;
const RETRY_DELAY_MS = 500;

/**
 * HTTP client of the internal `ocr` service (RapidOCR, see
 * docs/document-ocr.md). It runs only on the private network; every call
 * carries the shared token.
 *
 * Env: OCR_SERVICE_URL (e.g. http://finnit-ocr:8090), OCR_SERVICE_TOKEN.
 * Without both, `isConfigured` is false and every call throws
 * OcrUnavailableError, so the API still boots.
 *
 * Retries once on network errors and 5xx (not on timeouts: the service was
 * busy with our file and a second try would double the wait).
 */
@Injectable()
export class OcrClient {
  private readonly logger = new Logger(OcrClient.name);

  get isConfigured(): boolean {
    return Boolean(this.baseUrl && this.token);
  }

  private get baseUrl(): string | undefined {
    return process.env.OCR_SERVICE_URL?.trim().replace(/\/+$/, '') || undefined;
  }

  private get token(): string | undefined {
    return process.env.OCR_SERVICE_TOKEN?.trim() || undefined;
  }

  async health(): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Text lines and QR codes of a photo (JPEG, PNG, WEBP or HEIC). */
  async image(file: Buffer, mimeType: string): Promise<OcrImageResult> {
    const data = await this.post(
      '/v1/image',
      () => {
        const form = new FormData();
        form.append('file', toBlob(file, mimeType), fileNameFor(mimeType));
        return form;
      },
      OCR_TIMEOUT_MS,
    );
    return parseImageResult(data);
  }

  /** OCR of every page of a scanned PDF (the service rasterizes it). */
  async pdf(file: Buffer, maxPages?: number): Promise<OcrPdfResult> {
    const data = await this.post(
      '/v1/pdf',
      () => {
        const form = new FormData();
        form.append('file', toBlob(file, 'application/pdf'), 'document.pdf');
        if (maxPages) form.append('maxPages', String(maxPages));
        return form;
      },
      OCR_PDF_TIMEOUT_MS,
    );
    const pages = (data as { pages?: unknown }).pages;
    if (!Array.isArray(pages)) {
      throw new OcrUnavailableError('Unexpected OCR response');
    }
    return {
      pages: pages.map((page: Record<string, unknown>, index) => ({
        ...parseImageResult(page),
        page: typeof page.page === 'number' ? page.page : index + 1,
      })),
      timingsMs: (data as { timingsMs?: Record<string, number> }).timingsMs,
    };
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }

  /** POSTs a fresh form (a FormData body cannot be sent twice). */
  private async post(
    path: string,
    form: () => FormData,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!this.isConfigured) {
      throw new OcrUnavailableError('The OCR service is not configured');
    }
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.send(path, form(), timeoutMs);
      } catch (error) {
        const retry =
          attempt === 1 &&
          error instanceof RetryableOcrError &&
          !(
            error.cause instanceof Error && error.cause.name === 'TimeoutError'
          );
        if (!retry) {
          throw error instanceof RetryableOcrError
            ? new OcrUnavailableError(error.message)
            : error;
        }
        this.logger.warn(`OCR ${path} failed, retrying: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  private async send(
    path: string,
    body: FormData,
    timeoutMs: number,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(),
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = (error as Error)?.name === 'TimeoutError';
      throw new RetryableOcrError(
        timedOut
          ? 'The OCR service timed out'
          : 'The OCR service is unreachable',
        { cause: error },
      );
    }

    if (response.ok) {
      try {
        return await response.json();
      } catch {
        throw new OcrUnavailableError('Unexpected OCR response');
      }
    }

    const message = await errorMessage(response);
    if (response.status >= 500) {
      throw new RetryableOcrError(
        `The OCR service failed (${response.status}): ${message}`,
      );
    }
    if (response.status === 401 || response.status === 403) {
      // Our token is wrong: a configuration problem, not the user's file.
      throw new OcrUnavailableError(
        `The OCR service rejected the token (${response.status})`,
      );
    }
    throw new OcrRejectedError(message, response.status);
  }
}

/** Internal: failures worth one more try. Never escapes the client. */
class RetryableOcrError extends Error {}

function toBlob(file: Buffer, type: string): Blob {
  return new Blob([new Uint8Array(file)], { type });
}

function fileNameFor(mimeType: string): string {
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  return `upload.${extension}`;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: unknown;
      error?: unknown;
    };
    const text = body.message ?? body.error;
    if (typeof text === 'string' && text) return text.slice(0, 200);
  } catch {
    // not JSON
  }
  return response.statusText || `HTTP ${response.status}`;
}

/** The service's JSON is external input: keep only well-formed lines. */
function parseImageResult(data: unknown): OcrImageResult {
  const raw = (data ?? {}) as Record<string, unknown>;
  if (!Array.isArray(raw.lines)) {
    throw new OcrUnavailableError('Unexpected OCR response');
  }
  const lines: OcrLine[] = [];
  for (const line of raw.lines as Record<string, unknown>[]) {
    if (typeof line?.text !== 'string') continue;
    lines.push({
      text: line.text,
      confidence: typeof line.confidence === 'number' ? line.confidence : 0,
      box: Array.isArray(line.box) ? (line.box as number[][]) : [],
    });
  }
  const qr: OcrCode[] = [];
  for (const code of (Array.isArray(raw.qr) ? raw.qr : []) as Record<
    string,
    unknown
  >[]) {
    if (typeof code?.text !== 'string') continue;
    qr.push({
      text: code.text,
      format: typeof code.format === 'string' ? code.format : 'unknown',
    });
  }
  return {
    width: typeof raw.width === 'number' ? raw.width : 0,
    height: typeof raw.height === 'number' ? raw.height : 0,
    lines,
    qr,
    timingsMs: raw.timingsMs as Record<string, number> | undefined,
  };
}
