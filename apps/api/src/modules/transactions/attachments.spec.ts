import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PassThrough } from 'node:stream';
import { PrismaService } from '../../services/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { TransactionsService } from './transactions.service';

const userId = '11111111-1111-4111-8111-111111111111';
const pdf = Buffer.from('%PDF-1.7 receipt');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe('TransactionsService attachments', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let storage: DeepMockProxy<S3StorageService>;
  let service: TransactionsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    storage = mockDeep<S3StorageService>();
    service = new TransactionsService(prisma, storage);
  });

  const ownTransaction = (attachments = 0) =>
    prisma.transaction.findFirst.mockResolvedValue({
      id: 'txn-1',
      _count: { attachments },
    } as never);

  describe('uploadAttachment', () => {
    it("stores the file under the owner's prefix with its detected type", async () => {
      ownTransaction();
      prisma.attachment.create.mockImplementation(
        ({ data }) =>
          ({
            ...data,
            extra: null,
            fileUrl: null,
            uploadedAt: new Date(),
          }) as never,
      );

      const result = await service.uploadAttachment(userId, 'txn-1', {
        buffer: jpeg,
        size: jpeg.length,
        originalname: '../../etc/ticket café.JPG',
      });

      const [key, body, contentType] = storage.put.mock.calls[0];
      expect(key).toMatch(
        new RegExp(`^users/${userId}/attachments/[0-9a-f-]{36}\\.jpg$`),
      );
      expect(body).toBe(jpeg);
      expect(contentType).toBe('image/jpeg');
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'txn-1', userId } }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          fileName: 'ticket cafe.JPG',
          fileType: 'image/jpeg',
          downloadPath: `/attachments/${result.id}/file`,
        }),
      );
    });

    it('rejects files whose bytes are not an allowed type, whatever the name says', async () => {
      await expect(
        service.uploadAttachment(userId, 'txn-1', {
          buffer: Buffer.from('<html>…'),
          size: 7,
          originalname: 'ticket.pdf',
        }),
      ).rejects.toThrow(ValidationError);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it("rejects another user's transaction", async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);
      await expect(
        service.uploadAttachment(userId, 'txn-other', {
          buffer: pdf,
          size: pdf.length,
        }),
      ).rejects.toThrow(NotFoundError);
      expect(storage.put).not.toHaveBeenCalled();
    });

    it('limits size and number of attachments', async () => {
      await expect(
        service.uploadAttachment(userId, 'txn-1', {
          buffer: pdf,
          size: 11 * 1024 * 1024,
        }),
      ).rejects.toThrow('10 MB');
      ownTransaction(10);
      await expect(
        service.uploadAttachment(userId, 'txn-1', {
          buffer: pdf,
          size: pdf.length,
        }),
      ).rejects.toThrow('at most 10');
    });

    it('removes the stored file when the database insert fails', async () => {
      ownTransaction();
      prisma.attachment.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.uploadAttachment(userId, 'txn-1', {
          buffer: pdf,
          size: pdf.length,
        }),
      ).rejects.toThrow('db down');
      expect(storage.delete).toHaveBeenCalledWith(storage.put.mock.calls[0][0]);
    });
  });

  describe('openAttachment', () => {
    it('only opens attachments of the owner', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);
      await expect(service.openAttachment('att-1', userId)).rejects.toThrow(
        NotFoundError,
      );
      expect(prisma.attachment.findFirst).toHaveBeenCalledWith({
        where: { id: 'att-1', transaction: { userId } },
      });
      expect(storage.open).not.toHaveBeenCalled();
    });

    it('streams the stored file', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1',
        fileKey: `users/${userId}/attachments/att.pdf`,
        fileName: 'ticket.pdf',
        fileType: 'application/pdf',
      } as never);
      const body = new PassThrough();
      storage.open.mockResolvedValue({ body });

      const result = await service.openAttachment('att-1', userId);

      expect(result).toEqual({
        file: { body },
        fileName: 'ticket.pdf',
        fileType: 'application/pdf',
      });
    });
  });

  it('deletes the stored file with the attachment', async () => {
    prisma.attachment.findFirst.mockResolvedValue({
      id: 'att-1',
      fileKey: `users/${userId}/attachments/att.pdf`,
    } as never);
    await service.removeAttachment('att-1', userId);
    expect(prisma.attachment.delete).toHaveBeenCalledWith({
      where: { id: 'att-1' },
    });
    expect(storage.delete).toHaveBeenCalledWith(
      `users/${userId}/attachments/att.pdf`,
    );
  });
});
