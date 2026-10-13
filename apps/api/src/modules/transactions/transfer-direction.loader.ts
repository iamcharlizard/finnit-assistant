import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';

export type TransferDirection = 'in' | 'out';

/**
 * Whether a transfer transaction is the outgoing or incoming side, read from
 * the Transfer row. Batches every lookup of one request into a single query
 * (like DataLoader) and caches it for that request.
 */
@Injectable()
export class TransferDirectionLoader {
  private readonly cache = new WeakMap<
    object,
    Map<string, Promise<TransferDirection | null>>
  >();
  private readonly pending = new WeakMap<
    object,
    Map<string, (direction: TransferDirection | null) => void>
  >();

  constructor(private readonly prisma: PrismaService) {}

  load(
    request: object,
    transactionId: string,
  ): Promise<TransferDirection | null> {
    let cache = this.cache.get(request);
    if (!cache) {
      cache = new Map();
      this.cache.set(request, cache);
    }
    const cached = cache.get(transactionId);
    if (cached) return cached;

    let queue = this.pending.get(request);
    if (!queue) {
      const created = new Map<
        string,
        (direction: TransferDirection | null) => void
      >();
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
    const promise = new Promise<TransferDirection | null>((resolve) =>
      waiting.set(transactionId, resolve),
    );
    cache.set(transactionId, promise);
    return promise;
  }

  private async flush(
    queue: Map<string, (direction: TransferDirection | null) => void>,
  ): Promise<void> {
    const ids = [...queue.keys()];
    const transfers = await this.prisma.transfer
      .findMany({
        where: { OR: [{ fromTxnId: { in: ids } }, { toTxnId: { in: ids } }] },
        select: { fromTxnId: true, toTxnId: true },
      })
      .catch(() => []);
    const directions = new Map<string, TransferDirection>();
    for (const transfer of transfers) {
      directions.set(transfer.fromTxnId, 'out');
      directions.set(transfer.toTxnId, 'in');
    }
    for (const [id, resolve] of queue) resolve(directions.get(id) ?? null);
  }
}
