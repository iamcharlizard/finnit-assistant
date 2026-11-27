import * as React from 'react';
import { useTranslations } from 'use-intl';

import { createContact, loadContacts, type ApiContact } from '@finnit/core/contacts/api';
import { Select } from '@finnit/ui-native/components/ui/select';

import { useGql } from '@/lib/graphql/runner';
import { useLocalizer } from '@/lib/i18n/i18n-provider';

/**
 * The web's ContactCombobox: who lent the money, from the user's contacts,
 * searchable; what is typed can be added as a new contact.
 */
export function ContactSelect({
  label,
  value,
  name,
  onChange,
}: {
  label: string;
  /** The contact's id ('' = none). */
  value: string;
  /** Shown until the contacts load (the name already saved). */
  name: string;
  onChange: (contact: ApiContact | null) => void;
}) {
  const tc = useTranslations('contacts');
  const { t } = useLocalizer();
  const gql = useGql();
  const [contacts, setContacts] = React.useState<ApiContact[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    loadContacts(gql)
      .then((list) => !cancelled && setContacts(list))
      .catch(() => !cancelled && setContacts([]));
    return () => {
      cancelled = true;
    };
  }, [gql]);
  const options = (contacts ?? (value ? [{ id: value, name }] : [])).map((c) => ({ value: c.id, label: c.name }));
  return (
    <Select
      label={label}
      title={label}
      options={options}
      value={value || null}
      onValueChange={(id) => onChange(contacts?.find((c) => c.id === id) ?? null)}
      placeholder={name || tc('placeholder')}
      searchable
      searchPlaceholder={tc('search')}
      emptyLabel={tc('empty')}
      onCreate={(text) => {
        void createContact(text.trim(), gql).then((contact) => {
          setContacts((list) => [...(list ?? []).filter((c) => c.id !== contact.id), contact]);
          onChange(contact);
        });
      }}
      createLabel={(text) => tc('add', { name: text.trim() })}
      closeLabel={t('common.close')}
    />
  );
}
