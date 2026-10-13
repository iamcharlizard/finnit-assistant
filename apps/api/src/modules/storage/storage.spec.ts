import { ServiceUnavailableException } from '@nestjs/common';
import { detectFileType, safeFileName } from './file-type.util';
import { S3StorageService } from './s3-storage.service';

const userId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';

describe('detectFileType', () => {
  it.each([
    [Buffer.from('%PDF-1.7'), 'application/pdf'],
    [Buffer.from([0xff, 0xd8, 0xff, 0xdb]), 'image/jpeg'],
    [
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png',
    ],
    [Buffer.from('RIFF\0\0\0\0WEBPVP8 '), 'image/webp'],
    [Buffer.from('\0\0\0\x18ftypheic'), 'image/heic'],
  ])('detects %#', (bytes, mime) => {
    expect(detectFileType(bytes)?.mime).toBe(mime);
  });

  it('rejects anything else (HTML, SVG, executables)', () => {
    expect(detectFileType(Buffer.from('<svg xmlns='))).toBeNull();
    expect(detectFileType(Buffer.from('MZ\x90\0'))).toBeNull();
  });
});

describe('safeFileName', () => {
  it('drops paths and unsafe characters', () => {
    expect(safeFileName('../../etc/passwd', 'x')).toBe('passwd');
    expect(safeFileName('re"cibo<1>.pdf', 'x')).toBe('recibo1.pdf');
    expect(safeFileName(undefined, 'adjunto.pdf')).toBe('adjunto.pdf');
  });
});

describe('S3StorageService', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("builds keys under the owner's prefix", () => {
    expect(S3StorageService.key(userId, 'attachments', id, 'pdf')).toBe(
      `users/${userId}/attachments/${id}.pdf`,
    );
  });

  it('refuses keys outside users/<id>/', async () => {
    process.env.S3_BUCKET = 'bucket';
    const storage = new S3StorageService();
    for (const key of [
      '../secrets.txt',
      `users/${userId}/../../x.pdf`,
      'statements/x.pdf',
    ]) {
      await expect(storage.open(key)).rejects.toThrow(
        'Refusing unexpected storage key',
      );
    }
  });

  it('reports 503 when no bucket is configured', async () => {
    delete process.env.S3_BUCKET;
    const storage = new S3StorageService();
    expect(storage.isConfigured).toBe(false);
    await expect(
      storage.open(S3StorageService.key(userId, 'statements', id, 'pdf')),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
