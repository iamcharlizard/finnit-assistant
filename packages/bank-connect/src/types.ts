/** A field of a bank's login form, as described by Syncfy's catalog. */
export interface SiteField {
  name: string;
  /** text | password | select | array (array is not supported by the native form). */
  type: string;
  label: string;
  required?: boolean;
  validation?: string | null;
  options?: { label: string; value: string }[] | null;
}

/** An institution (bank, card issuer…) from Syncfy's catalog. */
export interface Site {
  id_site: string;
  name: string;
  /** Form version. The native flow supports version 1 (85 of 94 sites). */
  version?: number;
  is_personal?: number;
  is_business?: number;
  id_site_organization_type?: string;
  credentials: SiteField[];
}

/**
 * Something the bank asks for during the login (second factor). Syncfy
 * sends one or more per round, all in this shape.
 */
export interface TwofaField {
  name: string;
  /**
   * text: type a code (a captcha image may come in imgBase64File)
   * options: pick one of several images
   * textOptions: pick one of several labels
   * externalAction: act outside (e.g. scan the QR in imgBase64File); Syncfy
   *   detects it by itself, nothing is sent back
   */
  type: 'text' | 'options' | 'textOptions' | 'externalAction' | string;
  label: string;
  /** data: URI of an image to show (captcha, QR…). */
  imgBase64File?: string;
  options?: {
    value: string | number;
    label?: string;
    imgBase64File?: string;
  }[];
}

export type FieldValues = Record<string, string | number>;

/** Raw entry of Syncfy's job status list. */
export interface JobStatus {
  code: number;
  address?: string;
  twofa?: TwofaField[];
}

export interface CreatedCredential {
  id_credential: string;
  id_job: string;
  /** Absolute URL to poll the job status. */
  status: string;
  /** Absolute URL to send second-factor values. */
  twofa: string;
}
