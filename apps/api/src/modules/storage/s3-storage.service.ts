import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Private object storage on AWS S3 (or any S3-compatible server such as MinIO
 * in local development, via S3_ENDPOINT).
 *
 * Env: AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and,
 * only for S3-compatible servers, S3_ENDPOINT. Without S3_BUCKET the service
 * reports itself as not configured and every call fails with 503, so the API
 * still boots (e.g. in the smoke test).
 */
@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly bucket = process.env.S3_BUCKET;
  private readonly client?: S3Client;

  constructor() {
    if (!this.bucket) return;
    const endpoint = process.env.S3_ENDPOINT;
    this.client = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
      ...(endpoint && { endpoint, forcePathStyle: true }),
    });
  }

  get isConfigured(): boolean {
    return Boolean(this.client);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.require().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: process.env.S3_ENDPOINT ? undefined : 'AES256',
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.require().send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!result.Body) {
      throw new Error(`Empty object: ${key}`);
    }
    return Buffer.from(await result.Body.transformToByteArray());
  }

  /** Temporary download URL; the bucket itself stays private. */
  async signedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.require(),
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    try {
      await this.require().send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      // The database row is the source of truth; an orphaned object is only
      // wasted space, so log it instead of failing the user's request.
      this.logger.warn(`Could not delete ${key}: ${(error as Error).message}`);
    }
  }

  private require(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException('File storage is not configured');
    }
    return this.client;
  }
}
