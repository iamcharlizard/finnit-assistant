import type { GqlRunner } from '@/lib/accounts/api';

/** A person the user deals with (who lent them money, for now). */
export interface ApiContact {
  id: string;
  name: string;
}

export const CONTACTS_QUERY = `query Contacts { contacts { id name } }`;
export const CREATE_CONTACT_MUTATION = `mutation CreateContact($input: CreateContactInput!) { createContact(input: $input) { id name } }`;

export async function loadContacts(run: GqlRunner): Promise<ApiContact[]> {
  const data = await run<{ contacts: ApiContact[] }>(CONTACTS_QUERY);
  return data.contacts;
}

/** Adds a contact; the API returns the existing one with that name. */
export async function createContact(
  name: string,
  run: GqlRunner,
): Promise<ApiContact> {
  const data = await run<{ createContact: ApiContact }>(
    CREATE_CONTACT_MUTATION,
    { input: { name } },
  );
  return data.createContact;
}
