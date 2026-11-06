import { Injectable } from '@nestjs/common';
import type { WaitlistEntry as WaitlistRow } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { KeysetPage } from '../../common/utils/keyset-pagination.util';
import { isAppLocale } from '../translation/locale';
import {
  JoinWaitlistInput,
  JoinWaitlistResult,
  WaitlistEntriesArgs,
  WaitlistEntry,
  WaitlistEntryConnection,
} from './dto/waitlist.dto';

// Deliberately simple: one @, something before it and a dotted domain.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE = /^[\w.-]{1,64}$/;

function toModel(row: WaitlistRow): WaitlistEntry {
  return {
    id: row.id,
    email: row.email,
    locale: row.locale ?? undefined,
    source: row.source ?? undefined,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Adds the email once. Joining again keeps the first entry and answers the
   * same, so the response never reveals who is already on the list.
   */
  async join(input: JoinWaitlistInput): Promise<JoinWaitlistResult> {
    const email = input.email?.trim().toLowerCase() ?? '';
    if (email.length > 254 || !EMAIL.test(email)) {
      throw new ValidationError('Enter a valid email');
    }
    const locale =
      input.locale && isAppLocale(input.locale) ? input.locale : null;
    const source =
      input.source && SOURCE.test(input.source.trim())
        ? input.source.trim().toLowerCase()
        : null;

    await this.prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, locale, source },
      update: {},
    });
    return { ok: true };
  }

  /** Admin panel: newest first. */
  async list(args: WaitlistEntriesArgs): Promise<WaitlistEntryConnection> {
    const page = new KeysetPage(args, 50);
    const [rows, totalCount] = await Promise.all([
      this.prisma.waitlistEntry.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...page.query,
      }),
      this.prisma.waitlistEntry.count(),
    ]);
    return page.toConnection(rows, totalCount, toModel);
  }
}
