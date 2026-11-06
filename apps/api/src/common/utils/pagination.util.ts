import {
  PageInfo,
  Connection,
  Edge,
  PaginationArgs,
} from '../types/pagination.types';

/** Largest page any list returns, whatever `first`/`last` asks for. */
export const MAX_PAGE_SIZE = 200;

/** The page size to use: the requested one (or `fallback`), at most MAX_PAGE_SIZE. */
export function pageSize(
  requested: number | null | undefined,
  fallback = 20,
): number {
  const size = requested && requested > 0 ? Math.floor(requested) : fallback;
  return Math.min(size, MAX_PAGE_SIZE);
}

export class PaginationUtil {
  static createConnection<T>(
    items: T[],
    args: PaginationArgs,
    totalCount: number,
    cursorFn: (item: T) => string,
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
