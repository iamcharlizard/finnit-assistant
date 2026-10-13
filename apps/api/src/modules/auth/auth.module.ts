import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';
import { PrismaService } from '../../services/prisma.service';
import { getJwtSecret } from '../../common/utils/jwt-secret.util';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [
    AuthService,
    AuthResolver,
    JwtStrategy,
    GoogleIdTokenVerifier,
    PrismaService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
