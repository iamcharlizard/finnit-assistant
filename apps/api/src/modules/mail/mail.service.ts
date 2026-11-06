import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends email. Finnit has no email provider yet: MAIL_TRANSPORT selects the
 * implementation, and the only one is `console`, which logs the message (in
 * development the link shows in the API log). Connect the real provider by
 * adding a transport here; callers don't change.
 */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}

/** Fake transport: logs the email instead of sending it, and keeps the last ones (tests). */
@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger('Mail');
  readonly sent: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    if (this.sent.length > 20) this.sent.shift();
    this.logger.log(
      `[fake email, not sent] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
    return Promise.resolve();
  }
}
