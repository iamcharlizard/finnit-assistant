import { Readable } from 'node:stream';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  type ServerSideEncryption,
} from '@aws-sdk/client-s3';

/** Every object lives under its owner: users/<userId>/<kind>/<id>.<ext>. */
const KEY_PATTERN = /^users\/[0-9a-f-]{36}\/[a-z-]+\/[0-9a-f-]{36}\.[a-z0-9]+$/;

export interface StoredObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

/**
 * Private file storage on AWS S3. Files are never public and there are no
 * pre-signed URLs: the API reads and writes them with its own AWS keys and
 * streams them only to their owner, after checking ownership in the database.
 *
 * Env:
 * - S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * - S3_KMS_KEY_ID (optional): encrypt with this KMS key instead of SSE-S3
 * - S3_EXPECTED_BUCKET_OWNER (optional): AWS account id that must own the bucket
 * - S3_ENDPOINT (local development only, S3-compatible server)
 *
 * Without S3_BUCKET every call fails with 503, so the API still boots.
 */
@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly bucket = process.env.S3_BUCKET;
  private readonly kmsKeyId = process.env.S3_KMS_KEY_ID;
  private readonly expectedOwner = process.env.S3_EXPECTED_BUCKET_OWNER;
  private readonly isLocal = Boolean(process.env.S3_ENDPOINT);
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

  /** users/<userId>/<kind>/<id>.<ext> */
  static key(userId: string, kind: string, id: string, extension: string) {
    return `users/${userId}/${kind}/${id}.${extension}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.assertKey(key);
    const encryption: {
      ServerSideEncryption?: ServerSideEncryption;
      SSEKMSKeyId?: string;
    } = this.isLocal
      ? {}
      : this.kmsKeyId
        ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: this.kmsKeyId }
        : { ServerSideEncryption: 'AES256' };
    await this.require().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
        ChecksumAlgorithm: this.isLocal ? undefined : 'SHA256',
        ...encryption,
        ...this.ownerCheck(),
      }),
    );
  }

  /** Raw bytes, for server-side processing (e.g. parsing a statement). */
  async get(key: string): Promise<Buffer> {
    const { body } = await this.open(key);
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk as Buffer));
    return Buffer.concat(chunks);
  }

  /** Stream for sending a file to its owner. */
  async open(key: string): Promise<StoredObject> {
    this.assertKey(key);
    try {
      const result = await this.require().send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...this.ownerCheck(),
        }),
      );
      if (!result.Body) throw new NotFoundException('File not found');
      return {
        body: result.Body as Readable,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
      };
    } catch (error) {
      if (error instanceof NoSuchKey) {
        throw new NotFoundException('File not found');
      }
      // Without s3:ListBucket (least privilege) S3 answers AccessDenied, not
      // NoSuchKey, for a missing object. The database said the file exists,
      // so treat it as missing and leave a trace for real permission issues.
      if ((error as { name?: string }).name === 'AccessDenied') {
        this.logger.warn(`Access denied reading ${key} (missing object?)`);
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    this.assertKey(key);
    try {
      await this.require().send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ...this.ownerCheck(),
        }),
      );
    } catch (error) {
      // The database row is the source of truth; an orphaned object is only
      // wasted space, so log it instead of failing the user's request.
      this.logger.warn(`Could not delete ${key}: ${(error as Error).message}`);
    }
  }

  private ownerCheck() {
    return this.expectedOwner
      ? { ExpectedBucketOwner: this.expectedOwner }
      : {};
  }

  /** Refuses keys outside users/<id>/ (defense against path manipulation). */
  private assertKey(key: string) {
    if (!KEY_PATTERN.test(key)) {
      throw new Error(`Refusing unexpected storage key: ${key}`);
    }
  }

  private require(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException('File storage is not configured');
    }
    return this.client;
  }
}
