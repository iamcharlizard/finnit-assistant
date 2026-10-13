import { ObjectType, Field, Int } from '@nestjs/graphql';

/**
 * A file attached to a transaction (receipt, invoice, payment proof). Files
 * live in the private S3 bucket and are only served by the API to the owner:
 * GET {downloadPath} with the user's Bearer token.
 */
@ObjectType()
export class Attachment {
  @Field({ description: 'Unique identifier for the attachment' })
  id: string;

  @Field({ description: 'ID of the transaction this attachment belongs to' })
  transactionId: string;

  @Field({ nullable: true, description: 'Original file name' })
  fileName?: string;

  @Field({
    description: 'MIME type of the file (e.g., image/jpeg, application/pdf)',
  })
  fileType: string;

  @Field(() => Int, { nullable: true, description: 'File size in bytes' })
  fileSize?: number;

  @Field({
    nullable: true,
    description:
      'API path to download the file (authenticated, owner only); null for legacy external links',
  })
  downloadPath?: string;

  @Field({ description: 'When the file was uploaded' })
  uploadedAt: Date;
}
