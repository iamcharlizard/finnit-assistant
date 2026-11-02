import { Module } from '@nestjs/common';
import { ContactsResolver } from './contacts.resolver';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [ContactsResolver, ContactsService, PrismaService],
  exports: [ContactsService],
})
export class ContactsModule {}
