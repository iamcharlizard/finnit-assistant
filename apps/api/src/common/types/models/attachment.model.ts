import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { IsString, IsOptional, IsNumber, IsUrl } from 'class-validator';

@ObjectType()
export class Attachment {
  @Field({ description: 'Unique identifier for the attachment' })
  id: string;

  @Field({ description: 'ID of the transaction this attachment belongs to' })
  transactionId: string;

  @Field({ description: 'URL where the file is stored' })
  fileUrl: string;

  @Field({
    description: 'MIME type of the file (e.g., image/jpeg, application/pdf)',
  })
  fileType: string;

  @Field({ nullable: true, description: 'File size in bytes' })
  fileSize?: number;

  @Field({ nullable: true, description: 'Additional metadata in JSON format' })
  extra?: string;

  @Field({ description: 'When the file was uploaded' })
  uploadedAt: Date;
}

@InputType()
export class CreateAttachmentInput {
  @Field({ description: 'ID of the transaction this attachment belongs to' })
  @IsString()
  transactionId: string;

  @Field({ description: 'URL where the file is stored' })
  @IsUrl()
  fileUrl: string;

  @Field({ description: 'MIME type of the file' })
  @IsString()
  fileType: string;

  @Field({ nullable: true, description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @Field({ nullable: true, description: 'Additional metadata in JSON format' })
  @IsOptional()
  @IsString()
  extra?: string;
}

@InputType()
export class UpdateAttachmentInput {
  @Field({ nullable: true, description: 'URL where the file is stored' })
  @IsOptional()
  @IsUrl()
  fileUrl?: string;

  @Field({ nullable: true, description: 'MIME type of the file' })
  @IsOptional()
  @IsString()
  fileType?: string;

  @Field({ nullable: true, description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @Field({ nullable: true, description: 'Additional metadata in JSON format' })
  @IsOptional()
  @IsString()
  extra?: string;
}
