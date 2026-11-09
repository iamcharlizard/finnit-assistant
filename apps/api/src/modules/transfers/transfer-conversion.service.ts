import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TransactionSource,
  TransactionType,
  TransferSuggestionStatus,
} from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import {
  NotFoundError,
  TransferSameAccountError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import {
  appliedEffect,
  effectOf,
  moveBalance,
} from '../../common/utils/balance-effect.util';
import { Transaction } from '../../common/types/models/transaction.model';
import { Transfer } from '../../common/types/models/transfer.model';
import {
  TRANSACTION_PRESENTATION_INCLUDE,
  mapTransaction,
} from '../transactions/transaction.mapper';
import {
  CONVERTIBLE_TYPES,
  COUNTERPART_TYPES,
  isTransferPair,
  rankTransferCandidates,
  type TransferMovement,
} from './transfer-matching';
import { TransfersService } from './transfers.service';
import {
  becomeSide,
  dissolveTransfer,
  requireTransfer,
  transferOfMovement,
} from './transfer-dissolve';

type Client = Prisma.TransactionClient | PrismaService;

export interface ConvertToTransferInput {
  transactionId: string;
  /** The account on the other side. */
  counterpartAccountId: string;
  /** The movement already recorded there; without it one is created. */
  counterpartTransactionId?: string | null;
}

export { FREE_MOVEMENT } from './free-movement';
import { FREE_MOVEMENT } from './free-movement';

const MOVEMENT_SELECT = {
  id: true,
  userId: true,
  accountId: true,
  type: true,
  amount: true,
  balanceEffect: true,
  currency: true,
  txnDate: true,
  isPending: true,
  description: true,
  merchantName: true,
  aliasName: true,
  account: { select: { name: true, metadata: true } },
} satisfies Prisma.TransactionSelect;

type MovementRow = Prisma.TransactionGetPayload<{
  select: typeof MOVEMENT_SELECT;
}>;

const asMovement = (
  row: Pick<
    MovementRow,
    | 'id'
    | 'accountId'
    | 'type'
    | 'amount'
    | 'balanceEffect'
    | 'currency'
    | 'txnDate'
  >,
): TransferMovement => ({
  id: row.id,
  accountId: row.accountId,
  type: row.type,
  amount: Number(row.amount),
  effect: effectOf(row),
  currency: row.currency,
  txnDate: row.txnDate,
});

const accountLabel = (account: {
  name: string;
  metadata: Prisma.JsonValue;
}): string =>
  (account.metadata as { nickname?: string | null } | null)?.nickname?.trim() ||
  account.name;

/** The text of a side created by a conversion, in the user's language. */
export function createdSideDescription(
  locale: string,
  otherAccount: string,
  direction: 'in' | 'out',
): string {
  if (locale === 'en') {
    return direction === 'in'
      ? `Transfer from ${otherAccount}`
      : `Transfer to ${otherAccount}`;
  }
  return direction === 'in'
    ? `Transferencia desde ${otherAccount}`
    : `Transferencia a ${otherAccount}`;
}

/**
 * Turning a recorded expense or income into one side of a transfer between
 * the user's own accounts (and back). The balances never change for the
 * movements that already exist: only their type does. A side created
 * because the other account had nothing moves that account's balance.
 */
@Injectable()
export class TransferConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transfers: TransfersService,
  ) {}

  /**
   * Movements in other accounts that may be the other side, closest date
   * first: the same amount going the other way and not linked to anything
   * yet, from any month (the ones within a week come first).
   */
  async candidates(
    userId: string,
    transactionId: string,
    accountId?: string | null,
  ): Promise<Transaction[]> {
    const source = await this.convertible(this.prisma, userId, transactionId);
    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        ...FREE_MOVEMENT,
        accountId: accountId ?? { not: source.accountId },
        currency: source.currency,
        type: { in: [...COUNTERPART_TYPES] },
        amount: {
          gte: Number(source.amount) - 0.01,
          lte: Number(source.amount) + 0.01,
        },
      },
      include: { ...TRANSACTION_PRESENTATION_INCLUDE, account: true },
      // The closest are picked after ranking; this only bounds the read.
      orderBy: { txnDate: 'desc' },
      take: 200,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return rankTransferCandidates(
      asMovement(source),
      rows.map((row) => asMovement(row)),
    ).map((movement) => mapTransaction(byId.get(movement.id)!));
  }

  async convert(
    userId: string,
    input: ConvertToTransferInput,
  ): Promise<Transfer> {
    const transferId = await this.prisma.$transaction(async (tx) => {
      const source = await this.convertible(tx, userId, input.transactionId);
      if (input.counterpartAccountId === source.accountId) {
        throw new TransferSameAccountError();
      }
      const account = await tx.account.findFirst({
        where: { id: input.counterpartAccountId, userId },
        select: { id: true, currency: true, name: true, metadata: true },
      });
      if (!account) throw new NotFoundError('Destination account not found');
      if (account.currency !== source.currency) {
        throw new ValidationError('Currency conversion not supported yet');
      }

      const effect = effectOf(source);
      let counterpartId: string;
      if (input.counterpartTransactionId) {
        const other = await tx.transaction.findFirst({
          where: {
            id: input.counterpartTransactionId,
            userId,
            accountId: account.id,
            ...FREE_MOVEMENT,
          },
          select: MOVEMENT_SELECT,
        });
        if (!other) throw new NotFoundError('Counterpart movement not found');
        // Picked by hand: any date, as long as it is the same money.
        if (!isTransferPair(asMovement(source), asMovement(other), Infinity)) {
          throw new ValidationError(
            'The other movement must be the same amount going the other way',
          );
        }
        await becomeSide(tx, other);
        counterpartId = other.id;
      } else {
        // Nothing recorded on the other account: its side is created, and
        // moves its balance like any new movement.
        const counterEffect = -effect;
        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: account.id,
            type: TransactionType.transfer,
            amount: source.amount,
            balanceEffect: counterEffect,
            currency: source.currency,
            txnDate: source.txnDate,
            description: createdSideDescription(
              await this.localeOf(tx, userId),
              accountLabel(source.account),
              effect < 0 ? 'in' : 'out',
            ),
            source: TransactionSource.manual,
          },
          select: { id: true },
        });
        await moveBalance(tx, account.id, appliedEffect(counterEffect, false));
        counterpartId = created.id;
      }
      await becomeSide(tx, source);

      const [fromTxnId, toTxnId] =
        effect < 0 ? [source.id, counterpartId] : [counterpartId, source.id];
      const transfer = await tx.transfer.create({
        data: {
          fromTxnId,
          toTxnId,
          amount: source.amount,
          convertedAt: new Date(),
        },
        select: { id: true },
      });
      await tx.transferSuggestion.updateMany({
        where: {
          userId,
          transactionId: { in: [source.id, counterpartId] },
          status: TransferSuggestionStatus.pending,
        },
        data: { status: TransferSuggestionStatus.accepted },
      });
      return transfer.id;
    });
    return this.transfers.findById(transferId, userId);
  }

  /**
   * Undoes a conversion: the movements get their type back (without a
   * category: the user picks it again) and a side the conversion created is
   * deleted, reverting its balance. One the bank has since confirmed is kept
   * as an ordinary movement instead.
   */
  async undo(userId: string, transferId: string): Promise<boolean> {
    await this.prisma.$transaction(async (tx) => {
      const transfer = requireTransfer(
        await transferOfMovement(tx, { id: transferId, fromTxn: { userId } }),
      );
      if (!transfer.convertedAt) {
        throw new ValidationError(
          'Only transfers made from an existing movement can be undone',
        );
      }
      await dissolveTransfer(tx, transfer);
    });
    return true;
  }

  private async localeOf(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<string> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return user?.locale ?? 'es';
  }

  /** The movement, checked to be an expense/income free to convert. */
  private async convertible(
    client: Client,
    userId: string,
    id: string,
  ): Promise<MovementRow> {
    const row = await client.transaction.findFirst({
      where: { id, userId },
      select: {
        ...MOVEMENT_SELECT,
        transferFrom: { select: { id: true } },
        transferTo: { select: { id: true } },
        bankDifferenceOf: { select: { id: true } },
        debtPayment: { select: { id: true } },
        debtCharge: { select: { id: true } },
        debtDisbursement: { select: { id: true } },
      },
    });
    if (!row) throw new NotFoundError('Transaction not found');
    if (row.transferFrom || row.transferTo) {
      throw new ValidationError('This movement is already a transfer');
    }
    if (!CONVERTIBLE_TYPES.includes(row.type)) {
      throw new ValidationError(
        'Only expenses and income can become a transfer',
      );
    }
    if (row.debtPayment || row.debtCharge || row.debtDisbursement) {
      throw new ValidationError(
        'This movement belongs to a loan; change it from the loan',
      );
    }
    return row;
  }
}
