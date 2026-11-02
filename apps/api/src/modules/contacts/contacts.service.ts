import { Injectable } from '@nestjs/common';
import type { Prisma } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { Contact } from './dto/contact.dto';

type Client = PrismaService | Prisma.TransactionClient;

export const CONTACT_NAME_MAX = 120;

/** Spaces trimmed and collapsed: "  Ana   López " → "Ana López". */
export function contactName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * The user's contacts: people they deal with (who lent them money, for
 * now). A name is unique per user, ignoring case and extra spaces.
 */
@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(userId: string): Promise<Contact[]> {
    return this.prisma.contact.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdAt: true },
    });
  }

  /** Creates the contact, or returns the one with that name already. */
  async create(userId: string, name: string): Promise<Contact> {
    return this.findOrCreate(this.prisma, userId, name);
  }

  async findOrCreate(
    client: Client,
    userId: string,
    rawName: string,
  ): Promise<Contact> {
    const name = contactName(rawName);
    if (!name) throw new ValidationError('The name cannot be empty');
    if (name.length > CONTACT_NAME_MAX) {
      throw new ValidationError('The name is too long');
    }
    const select = { id: true, name: true, createdAt: true };
    const existing = await client.contact.findFirst({
      where: { userId, name: { equals: name, mode: 'insensitive' } },
      select,
    });
    if (existing) return existing;
    return client.contact.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name },
      update: {},
      select,
    });
  }

  async findById(client: Client, userId: string, id: string): Promise<Contact> {
    const contact = await client.contact.findFirst({
      where: { id, userId },
      select: { id: true, name: true, createdAt: true },
    });
    if (!contact) throw new NotFoundError('Contact not found');
    return contact;
  }
}
