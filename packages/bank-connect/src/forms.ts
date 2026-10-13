import { messagesFor, type Locale } from './messages';
import type { FieldValues, Site, SiteField, TwofaField } from './types';

/** Login field types the native form can render. */
const SUPPORTED_FIELD_TYPES = new Set(['text', 'password', 'select']);
/** Second-factor types the native flow can render. */
const SUPPORTED_TWOFA_TYPES = new Set([
  'text',
  'options',
  'textOptions',
  'externalAction',
]);

/** Syncfy organization type id for banks. */
export const BANK_ORGANIZATION_TYPE = '56cf4f5b784806cf028b4568';

/**
 * Whether the native form can connect this site. The rest (form versions 3/4,
 * unusual field types) must use Syncfy's widget.
 */
export function isNativeSupported(site: Site): boolean {
  return (
    (site.version ?? 1) === 1 &&
    site.credentials.length > 0 &&
    site.credentials.every((field) => SUPPORTED_FIELD_TYPES.has(field.type))
  );
}

export function isTwofaSupported(fields: TwofaField[]): boolean {
  return fields.every((field) => SUPPORTED_TWOFA_TYPES.has(field.type));
}

/** Personal bank sites, alphabetical, the ones the native form supports first. */
export function personalBanks(sites: Site[]): Site[] {
  return sites
    .filter(
      (site) =>
        site.id_site_organization_type === BANK_ORGANIZATION_TYPE &&
        site.is_personal !== 0,
    )
    .sort(
      (a, b) =>
        Number(isNativeSupported(b)) - Number(isNativeSupported(a)) ||
        a.name.localeCompare(b.name, 'es'),
    );
}

export interface FieldError {
  name: string;
  message: string;
}

/** Checks a login form or a second-factor answer before sending it. */
export function validateFields(
  fields: (SiteField | TwofaField)[],
  values: FieldValues,
  locale?: Locale,
): FieldError[] {
  const texts = messagesFor(locale).fields;
  const errors: FieldError[] = [];
  for (const field of fields) {
    if (field.type === 'externalAction') continue;
    const value = values[field.name];
    const empty = value === undefined || String(value).trim() === '';
    const required = 'required' in field ? field.required !== false : true;
    if (empty) {
      if (required) errors.push({ name: field.name, message: texts.required });
      continue;
    }
    const options = field.options ?? null;
    if (options && !options.some((o) => String(o.value) === String(value))) {
      errors.push({ name: field.name, message: texts.invalidOption });
      continue;
    }
    const pattern = 'validation' in field ? field.validation : null;
    if (pattern) {
      try {
        if (!new RegExp(pattern).test(String(value))) {
          errors.push({ name: field.name, message: texts.invalidFormat });
        }
      } catch {
        // A pattern Syncfy sends that JS can't compile: let the bank decide.
      }
    }
  }
  return errors;
}

/** Values to send: only the form's fields, text trimmed (passwords untouched). */
export function buildValues(
  fields: (SiteField | TwofaField)[],
  values: FieldValues,
): FieldValues {
  const result: FieldValues = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.type === 'externalAction') {
      result[field.name] = value ?? '';
    } else if (value !== undefined) {
      result[field.name] =
        typeof value === 'string' && field.type !== 'password'
          ? value.trim()
          : value;
    }
  }
  return result;
}
