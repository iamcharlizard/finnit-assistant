import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** JWT guard for REST controllers; GraphQL resolvers use JwtAuthGuard. */
@Injectable()
export class JwtHttpAuthGuard extends AuthGuard('jwt') {}
