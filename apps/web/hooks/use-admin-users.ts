'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import {
  ADMIN_USERS_QUERY,
  USERS_PAGE_SIZE,
  type AdminUser,
  type AdminUsersPage,
  type UserRole,
  type UserStatus,
} from '@/lib/admin/users';
import { adminErrorMessage } from '@/lib/admin/errors';
import { gql } from '@/lib/graphql/client';

export interface AdminUsersFilters {
  search: string;
  status?: UserStatus;
  role?: UserRole;
}

/**
 * The admin panel's user list: first page whenever the filters change,
 * "Cargar más" with the cursor, and in-place updates after a mutation.
 */
export function useAdminUsers(filters: AdminUsersFilters) {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Answers to an older search arrive late; only the latest one counts.
  const requestId = React.useRef(0);
  const t = useTranslations();
  const { search, status, role } = filters;

  const fetchPage = React.useCallback(
    (after: string | null) =>
      gql<AdminUsersPage>(ADMIN_USERS_QUERY, {
        first: USERS_PAGE_SIZE,
        after,
        search: search.trim() || null,
        status: status ?? null,
        role: role ?? null,
      }),
    [search, status, role],
  );

  const reload = React.useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const { adminUsers } = await fetchPage(null);
      if (id !== requestId.current) return;
      setUsers(adminUsers.edges.map((e) => e.node));
      setTotalCount(adminUsers.totalCount);
      setCursor(adminUsers.pageInfo.endCursor);
      setHasNextPage(adminUsers.pageInfo.hasNextPage);
    } catch (e) {
      if (id === requestId.current) setError(adminErrorMessage(e, t));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetchPage, t]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = React.useCallback(async () => {
    if (!cursor) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const { adminUsers } = await fetchPage(cursor);
      if (id !== requestId.current) return;
      setUsers((current) => {
        const seen = new Set(current.map((u) => u.id));
        return [
          ...current,
          ...adminUsers.edges.map((e) => e.node).filter((u) => !seen.has(u.id)),
        ];
      });
      setTotalCount(adminUsers.totalCount);
      setCursor(adminUsers.pageInfo.endCursor);
      setHasNextPage(adminUsers.pageInfo.hasNextPage);
    } catch (e) {
      if (id === requestId.current) setError(adminErrorMessage(e, t));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, fetchPage, t]);

  /** Shows a mutation's result without reloading the list. */
  const replace = React.useCallback((user: AdminUser) => {
    setUsers((current) => current.map((u) => (u.id === user.id ? user : u)));
  }, []);

  return {
    users,
    totalCount,
    hasNextPage,
    loading,
    loadingMore,
    error,
    loadMore,
    reload,
    replace,
  };
}
