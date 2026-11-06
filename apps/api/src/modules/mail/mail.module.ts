import { Logger, Module } from '@nestjs/common';
import { ConsoleMailService, MailService } from './mail.service';

/** MAIL_TRANSPORT: `console` (default, logs instead of sending). */
@Module({
  providers: [
    {
      provide: MailService,
      useFactory: () => {
        const transport = process.env.MAIL_TRANSPORT ?? 'console';
        if (transport !== 'console') {
          new Logger('Mail').warn(
            `MAIL_TRANSPORT=${transport} is not available yet; emails are only logged`,
          );
        }
        return new ConsoleMailService();
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
