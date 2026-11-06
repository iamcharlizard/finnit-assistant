'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { Combobox } from '@finnit/ui/components/ui/combobox';
import { toast } from '@finnit/ui/components/ui/toaster';

import {
  createContact,
  loadContacts,
  type ApiContact,
} from '@finnit/core/contacts/api';
import { gql, requestErrorMessage } from '@/lib/graphql/client';
import { useLocalizer } from '@/lib/i18n/client';

/**
 * Picks one of the user's contacts, or adds a new one by typing its name.
 * Loads the list when mounted; `name` is the fallback label while it loads.
 */
export function ContactCombobox({
  label,
  value,
  name,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  /** Contact id; '' = none. */
  value: string;
  /** Name of the chosen contact (shown before the list loads). */
  name?: string;
  onChange: (contact: ApiContact | null) => void;
  /** Shown when nothing is picked (e.g. a name the AI suggested). */
  placeholder?: string;
  error?: string;
}) {
  const t = useTranslations('contacts');
  const { t: translate } = useLocalizer();
  const [contacts, setContacts] = React.useState<ApiContact[] | null>(null);

  React.useEffect(() => {
    let active = true;
    loadContacts(gql)
      .then((found) => active && setContacts(found))
      .catch(() => active && setContacts([]));
    return () => {
      active = false;
    };
  }, []);

  const options = React.useMemo(() => {
    const list = contacts ?? [];
    const known = list.some((contact) => contact.id === value);
    return [
      ...list,
      // The chosen one while the list loads (or if it was just made).
      ...(value && !known && name ? [{ id: value, name }] : []),
    ].map((contact) => ({ value: contact.id, label: contact.name }));
  }, [contacts, value, name]);

  async function add(text: string) {
    try {
      const created = await createContact(text, gql);
      setContacts((current) =>
        [...(current ?? []).filter((c) => c.id !== created.id), created].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      );
      onChange(created);
    } catch (cause) {
      toast.error(requestErrorMessage(cause, translate));
    }
  }

  return (
    <Combobox
      label={label}
      options={options}
      value={value || undefined}
      onChange={(id) =>
        onChange(
          id
            ? (options
                .map((o) => ({ id: o.value, name: o.label }))
                .find((c) => c.id === id) ?? null)
            : null,
        )
      }
      placeholder={placeholder ?? t('placeholder')}
      searchPlaceholder={t('search')}
      emptyText={contacts === null ? t('loading') : t('empty')}
      createLabel={(text) => t('add', { name: text })}
      onCreate={add}
      clearable
      error={error}
    />
  );
}
