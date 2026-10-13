import { Injectable } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

export interface GoogleIdentity {
  /** Google's stable account id. */
  subject: string;
  email: string;
  emailVerified: boolean;
  nonce?: string;
}

/** Thrown when the token is invalid, expired or for another app. */
export class InvalidGoogleTokenError extends Error {}

/**
 * Verifies Google ID tokens (signature, expiry, issuer and audience).
 * GOOGLE_CLIENT_IDS lists the OAuth client ids of every Finnit app
 * (web, iOS, Android), comma-separated.
 */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly client = new OAuth2Client();

  get audiences(): string[] {
    return (process.env.GOOGLE_CLIENT_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  get isConfigured(): boolean {
    return this.audiences.length > 0;
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.audiences,
      });
      payload = ticket.getPayload();
    } catch (error) {
      throw new InvalidGoogleTokenError((error as Error).message);
    }
    if (!payload?.sub || !payload.email) {
      throw new InvalidGoogleTokenError('The token has no account or email');
    }
    return {
      subject: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      nonce: payload.nonce,
    };
  }
}
