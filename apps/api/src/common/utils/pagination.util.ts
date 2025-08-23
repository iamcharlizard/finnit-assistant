import { PageInfo, Connection, Edge, PaginationArgs } from '../types/pagination.types';

export class PaginationUtil {
  static createConnection<T>(
    items: T[],
    args: PaginationArgs,
    totalCount: number,
    cursorFn: (item: T) => string
  ): Connection<T> {
    const edges: Edge<T>[] = items.map((item) => ({
      node: item,
      cursor: cursorFn(item),
    }));

    const pageInfo: PageInfo = {
      startCursor: edges.length > 0 ? edges[0].cursor : undefined,
      endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
      hasNextPage: false,
      hasPreviousPage: false,
    };

    // Determine hasNextPage and hasPreviousPage logic
    if (args.first) {
      pageInfo.hasNextPage = items.length === args.first;
      pageInfo.hasPreviousPage = !!args.after;
    } else if (args.last) {
      pageInfo.hasPreviousPage = items.length === args.last;
      pageInfo.hasNextPage = !!args.before;
    }

    return {
      edges,
      pageInfo,
      totalCount,
    };
  }

  static encodeCursor(value: string | Date): string {
    return Buffer.from(value.toString()).toString('base64');
  }

  static decodeCursor(cursor: string): string {
    return Buffer.from(cursor, 'base64').toString('ascii');
  }
}