import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { Contact, CreateContactInput } from './dto/contact.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';

@Resolver(() => Contact)
@UseGuards(JwtAuthGuard)
export class ContactsResolver {
  constructor(private readonly service: ContactsService) {}

  @Query(() => [Contact], { description: 'By name' })
  async contacts(@CurrentUser() user: User): Promise<Contact[]> {
    return this.service.findMany(user.id);
  }

  @Mutation(() => Contact, {
    description: 'Adds a contact; returns the existing one with that name',
  })
  async createContact(
    @CurrentUser() user: User,
    @Args('input') input: CreateContactInput,
  ): Promise<Contact> {
    return this.service.create(user.id, input.name);
  }
}
