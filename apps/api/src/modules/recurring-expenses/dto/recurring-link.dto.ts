import {
  Field,
  Float,
  ID,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { RecurringExpenseKind } from '@finnit/database';

export enum RecurringLinkSlotStatus {
  pending = 'pending',
  missed = 'missed',
  /** Marked paid by hand without a movement: it takes this one. */
  paid_without_movement = 'paid_without_movement',
  /** Already paid with another movement. */
  linked = 'linked',
  /** Not generated (before the start date or off schedule): created on linking. */
  unscheduled = 'unscheduled',
}
registerEnumType(RecurringLinkSlotStatus, { name: 'RecurringLinkSlotStatus' });

@ObjectType({ description: "A recurring expense's payment in one month" })
export class RecurringLinkSlot {
  @Field({ description: 'YYYY-MM' })
  month: string;

  @Field()
  dueDate: Date;

  @Field(() => RecurringLinkSlotStatus)
  status: RecurringLinkSlotStatus;

  @Field(() => Float)
  expectedAmount: number;
}

@ObjectType({
  description:
    'A recurring expense (not a loan) an expense may have paid, with its payment in each month the dialog offers',
})
export class RecurringLinkExpense {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => RecurringExpenseKind)
  kind: RecurringExpenseKind;

  @Field(() => Float)
  amount: number;

  @Field()
  active: boolean;

  @Field(() => ID, {
    nullable: true,
    description: 'The category the expense takes when linked',
  })
  categoryId: string | null;

  @Field({ description: "Its pattern (or name) is in the expense's bank text" })
  nameMatches: boolean;

  @Field({
    description:
      "Its payment in the expense's month is due near its day with a similar amount",
  })
  fits: boolean;

  @Field(() => [RecurringLinkSlot])
  slots: RecurringLinkSlot[];
}

@ObjectType()
export class RecurringLinkOptions {
  @Field({ description: "The expense's month (YYYY-MM), chosen by default" })
  month: string;

  @Field(() => [String], { description: 'The months that can be chosen' })
  months: string[];

  @Field(() => ID, {
    nullable: true,
    description: 'The one that fits best, selected by default',
  })
  proposedId: string | null;

  @Field(() => [RecurringLinkExpense], {
    description: 'Those that fit first, then the rest',
  })
  expenses: RecurringLinkExpense[];
}
