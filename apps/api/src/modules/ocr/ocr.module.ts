import { Module } from '@nestjs/common';
import { OcrClient } from './ocr.client';

/** Client of the internal OCR service (docs/document-ocr.md). */
@Module({
  providers: [OcrClient],
  exports: [OcrClient],
})
export class OcrModule {}
