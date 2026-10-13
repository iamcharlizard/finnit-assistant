import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../services/prisma.service';
import { getJwtSecret } from '../../../common/utils/jwt-secret.util';
import { isSessionValid } from '../auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
  /** User.tokenVersion when the token was issued. */
  ver?: number;
  /** Token kind; tokens issued before it existed have none. */
  typ?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  /** Disabled users and revoked sessions are rejected on every request. */
  async validate(payload: JwtPayload) {
    // Refresh and reset tokens can't be used as access tokens.
    if (!payload.sub || (payload.typ && payload.typ !== 'access')) {
      throw new UnauthorizedException('Invalid token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !isSessionValid(user, payload.ver)) {
      throw new UnauthorizedException('Session ended');
    }

    return user;
  }
}
