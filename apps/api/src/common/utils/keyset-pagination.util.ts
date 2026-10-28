import { Connection, PaginationArgs } from '../types/pagination.types';
import { PaginationUtil } from './pagination.util';

/**
 * Keyset pagination in the list's own order (e.g. newest first with `id` as
 * the tie-breaker), so pages never skip or repeat rows. The cursor is the row
 * id; Prisma resolves it to the row's position in `orderBy`. One extra row
 * tells whether more remain in the direction of travel.
 *
 * Spread `query` into `findMany` (together with an `orderBy` that ends in a
 * unique field) and pass the rows to `toConnection`.
 */
export class KeysetPage {
  readonly limit: number;
  readonly backward: boolean;
  readonly cursorId?: string;

  constructor(
    private readonly args: PaginationArgs,
    defaultLimit = 20,
  ) {
    this.limit = args.first || args.last || defaultLimit;
    this.backward = !args.first && !args.after && Boolean(args.before);
    this.cursorId = args.after ?? args.before;
  }

  get query(): {
    take: number;
    cursor?: { id: string };
    skip?: number;
  } {
    return {
      take: this.backward ? -(this.limit + 1) : this.limit + 1,
      ...(this.cursorId && {
        cursor: { id: PaginationUtil.decodeCursor(this.cursorId) },
        skip: 1,
      }),
    };
  }

  /** Trims the look-ahead row, then builds the connection with id cursors. */
  toConnection<Row, Node extends { id: string }>(
    rows: Row[],
    totalCount: number,
    map: (row: Row) => Node,
  ): Connection<Node> {
    const hasMore = rows.length > this.limit;
    const page = this.backward
      ? rows.slice(hasMore ? 1 : 0)
      : rows.slice(0, this.limit);

    const connection = PaginationUtil.createConnection(
      page.map(map),
      this.args,
      totalCount,
      (node) => PaginationUtil.encodeCursor(node.id),
    );
    connection.pageInfo.hasNextPage = this.backward ? true : hasMore;
    connection.pageInfo.hasPreviousPage = this.backward
      ? hasMore
      : !!this.cursorId;
    return connection;
  }
}
