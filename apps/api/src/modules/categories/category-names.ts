import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { AppLocale } from '../translation/locale';

export interface CategoryI18n {
  key: string | null;
  /** Name in the requested locale (the English original when missing). */
  name: string;
  originalName: string;
}

type PrismaLike = Pick<PrismaService, 'category'>;

/**
 * Localized names (and keys) of categories, in one query. Other modules
 * that return a category name as a plain string (reports, budgets) can use
 * it with `resolveLocale(req)`.
 */
export async function loadCategoryI18n(
  prisma: PrismaLike,
  ids: readonly string[],
  locale: AppLocale,
): Promise<Map<string, CategoryI18n>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await prisma.category.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      key: true,
      name: true,
      translations: { where: { locale }, select: { name: true } },
    },
  });
  return new Map(
    rows.map((row) => [
      row.id,
      {
        key: row.key,
        name: row.translations[0]?.name ?? row.name,
        originalName: row.name,
      },
    ]),
  );
}

interface Queue {
  locale: AppLocale;
  ids: Map<string, ((value: CategoryI18n | undefined) => void)[]>;
  reject: ((error: unknown) => void)[];
}

/**
 * Per-request batching for the Category field resolvers (DataLoader-style):
 * every category resolved in the same tick of a request is looked up in a
 * single query, and results are cached for the rest of the request.
 */
@Injectable()
export class CategoryI18nLoader {
  private readonly cache = new WeakMap<
    object,
    Map<string, Promise<CategoryI18n | undefined>>
  >();
  private readonly queues = new WeakMap<object, Map<AppLocale, Queue>>();

  constructor(private readonly prisma: PrismaService) {}

  load(
    request: object,
    id: string,
    locale: AppLocale,
  ): Promise<CategoryI18n | undefined> {
    let cache = this.cache.get(request);
    if (!cache) {
      cache = new Map();
      this.cache.set(request, cache);
    }
    const cacheKey = `${locale}:${id}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const promise = new Promise<CategoryI18n | undefined>((resolve, reject) => {
      const queue = this.queueFor(request, locale);
      const waiting = queue.ids.get(id) ?? [];
      waiting.push(resolve);
      queue.ids.set(id, waiting);
      queue.reject.push(reject);
    });
    cache.set(cacheKey, promise);
    return promise;
  }

  private queueFor(request: object, locale: AppLocale): Queue {
    let byLocale = this.queues.get(request);
    if (!byLocale) {
      byLocale = new Map();
      this.queues.set(request, byLocale);
    }
    let queue = byLocale.get(locale);
    if (!queue) {
      const created: Queue = { locale, ids: new Map(), reject: [] };
      byLocale.set(locale, created);
      queue = created;
      // Like DataLoader: wait for the resolvers of this tick to enqueue.
      void Promise.resolve().then(() =>
        process.nextTick(() => {
          byLocale.delete(locale);
          void this.flush(created);
        }),
      );
    }
    return queue;
  }

  private async flush(queue: Queue): Promise<void> {
    try {
      const found = await loadCategoryI18n(
        this.prisma,
        [...queue.ids.keys()],
        queue.locale,
      );
      for (const [id, resolvers] of queue.ids) {
        for (const resolve of resolvers) resolve(found.get(id));
      }
    } catch (error) {
      for (const reject of queue.reject) reject(error);
    }
  }
}
