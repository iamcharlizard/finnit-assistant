import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';

export type TransferDirection = 'in' | 'out';

/** A transfer movement's side and the transfer it belongs to. */
export interface TransferSide {
  direction: TransferDirection;
  transferId: string;
}

/**
 * Whether a transfer transaction is the outgoing or incoming side, and the
 * transfer it belongs to, read from the Transfer row. Batches every lookup
 * of one request into a single query (like DataLoader) and caches it for
 * that request.
 */
@Injectable()
export class TransferDirectionLoader {
  private readonly cache = new WeakMap<
    object,
    Map<string, Promise<TransferSide | null>>
  >();
  private readonly pending = new WeakMap<
    object,
    Map<string, (side: TransferSide | null) => void>
  >();

  constructor(private readonly prisma: PrismaService) {}

  async load(
    request: object,
    transactionId: string,
  ): Promise<TransferDirection | null> {
    return (await this.loadSide(request, transactionId))?.direction ?? null;
  }

  loadSide(
    request: object,
    transactionId: string,
  ): Promise<TransferSide | null> {
    let cache = this.cache.get(request);
    if (!cache) {
      cache = new Map();
      this.cache.set(request, cache);
    }
    const cached = cache.get(transactionId);
    if (cached) return cached;

    let queue = this.pending.get(request);
    if (!queue) {
      const created = new Map<string, (side: TransferSide | null) => void>();
      this.pending.set(request, created);
      queue = created;
      // Wait for the other resolvers of this tick to enqueue their ids.
      void Promise.resolve().then(() =>
        process.nextTick(() => {
          this.pending.delete(request);
          void this.flush(created);
        }),
      );
    }
    const waiting = queue;
    const promise = new Promise<TransferSide | null>((resolve) =>
      waiting.set(transactionId, resolve),
    );
    cache.set(transactionId, promise);
    return promise;
  }

  private async flush(
    queue: Map<string, (side: TransferSide | null) => void>,
  ): Promise<void> {
    const ids = [...queue.keys()];
    const transfers = await this.prisma.transfer
      .findMany({
        where: { OR: [{ fromTxnId: { in: ids } }, { toTxnId: { in: ids } }] },
        select: { id: true, fromTxnId: true, toTxnId: true },
      })
      .catch(() => []);
    const sides = new Map<string, TransferSide>();
    for (const transfer of transfers) {
      sides.set(transfer.fromTxnId, {
        direction: 'out',
        transferId: transfer.id,
      });
      sides.set(transfer.toTxnId, { direction: 'in', transferId: transfer.id });
    }
    for (const [id, resolve] of queue) resolve(sides.get(id) ?? null);
  }
}
