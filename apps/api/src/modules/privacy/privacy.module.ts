import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { PrismaService } from '../../services/prisma.service';
import { getJwtSecret } from '../../common/utils/jwt-secret.util';
import { MailModule } from '../mail/mail.module';
import { PrivacyResolver } from './privacy.resolver';
import { PrivacyService } from './privacy.service';

/** The privacy PIN that protects automatic names (see PrivacyService). */
@Module({
  imports: [JwtModule.register({ secret: getJwtSecret() }), MailModule],
  providers: [PrivacyService, PrivacyResolver, PrismaService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
