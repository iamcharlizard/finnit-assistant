import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testLocalizer } from '@/lib/i18n/testing';
import { aiFeatureCopy, needsPdfModel } from './ai';
import { adminErrorMessage } from './errors';
import {
  availableActions,
  formatDate,
  formatLastSignIn,
  generatePassword,
  type AdminUser,
} from './users';

const user = (overrides: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u1',
  name: 'Ana',
  email: 'ana@test.dev',
  role: 'user',
  isMaster: false,
  status: 'active',
  hasPassword: true,
  hasGoogle: false,
  lastLoginAt: null,
  invitedByName: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});
const master = { id: 'm', isMaster: true };
const admin = { id: 'a', isMaster: false };

describe('generatePassword', () => {
  it('is long, mixed and different every time', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const password = generatePassword();
      assert.equal(password.length, 16);
      assert.match(password, /[A-Z]/);
      assert.match(password, /[a-z]/);
      assert.match(password, /[0-9]/);
      assert.match(password, /[^A-Za-z0-9]/);
      assert.doesNotMatch(password, /[O0Il1]/);
      seen.add(password);
    }
    assert.equal(seen.size, 50);
  });
});

describe('availableActions', () => {
  it('lets only the master change roles, never the master', () => {
    assert.ok(availableActions(user(), master).includes('makeAdmin'));
    assert.ok(
      availableActions(user({ role: 'admin' }), master).includes('removeAdmin'),
    );
    assert.ok(!availableActions(user(), admin).includes('makeAdmin'));
    const self = availableActions(
      user({ id: 'm', role: 'admin', isMaster: true }),
      master,
    );
    assert.ok(!self.includes('removeAdmin') && !self.includes('disable'));
  });

  it('hides the master from other admins and disabling yourself', () => {
    assert.deepEqual(
      availableActions(user({ id: 'm', isMaster: true, role: 'admin' }), admin),
      [],
    );
    assert.ok(!availableActions(user({ id: 'a' }), admin).includes('disable'));
    assert.ok(availableActions(user(), admin).includes('disable'));
    assert.ok(
      availableActions(user({ status: 'disabled' }), admin).includes('enable'),
    );
  });

  it('offers removing the password only with Google linked', () => {
    assert.ok(!availableActions(user(), admin).includes('removePassword'));
    const linked = availableActions(user({ hasGoogle: true }), admin);
    assert.ok(linked.includes('removePassword'));
    assert.ok(linked.includes('unlinkGoogle'));
    assert.ok(
      !availableActions(
        user({ hasGoogle: true, hasPassword: false }),
        admin,
      ).includes('removePassword'),
    );
  });
});

describe('dates', () => {
  const now = new Date(2026, 9, 13, 12, 0).getTime();
  const es = testLocalizer('es');
  const en = testLocalizer('en');
  it('shows recent sign-ins relatively, older ones as a date', () => {
    const ago = (ms: number) => new Date(now - ms).toISOString();
    assert.equal(formatLastSignIn(null, es, now), 'Nunca');
    assert.equal(formatLastSignIn(ago(5 * 60_000), es, now), 'Hace 5 min');
    assert.equal(formatLastSignIn(ago(3 * 3_600_000), es, now), 'Hace 3 h');
    assert.equal(formatLastSignIn(ago(30 * 3_600_000), es, now), 'Ayer');
    assert.equal(formatLastSignIn(ago(3 * 86_400_000), es, now), 'Hace 3 días');
    assert.equal(
      formatLastSignIn(new Date(2026, 0, 5, 10).toISOString(), es, now),
      '05/01/2026',
    );
    assert.equal(
      formatDate(new Date(2026, 11, 31).toISOString(), 'es'),
      '31/12/2026',
    );
  });

  it('speaks English too', () => {
    const ago = (ms: number) => new Date(now - ms).toISOString();
    assert.equal(formatLastSignIn(null, en, now), 'Never');
    assert.equal(formatLastSignIn(ago(5 * 60_000), en, now), '5 min ago');
    assert.equal(
      formatDate(new Date(2026, 11, 31).toISOString(), 'en'),
      '12/31/2026',
    );
  });
});

describe('adminErrorMessage', () => {
  const { t } = testLocalizer('es');
  it('translates the API messages', () => {
    assert.equal(
      adminErrorMessage(
        {
          message: 'A user with this email already exists',
          code: 'CONFLICT',
        },
        t,
      ),
      'Ya existe un usuario con ese correo.',
    );
    assert.equal(
      adminErrorMessage(
        {
          message: 'Only the master administrator can create admins',
          code: 'FORBIDDEN',
        },
        t,
      ),
      'Solo el administrador maestro puede hacer esto.',
    );
    assert.equal(
      adminErrorMessage({ message: 'Something new', code: 'FORBIDDEN' }, t),
      'No tienes permiso para hacer esto.',
    );
    assert.equal(
      adminErrorMessage({ message: 'offline', code: 'NETWORK_ERROR' }, t),
      'No pudimos conectar con Finnit. Revisa tu conexión.',
    );
    assert.equal(
      adminErrorMessage({ message: 'boom', code: 'INTERNAL_SERVER_ERROR' }, t),
      'Ocurrió un error. Intenta de nuevo.',
    );
    assert.equal(
      adminErrorMessage(
        { message: 'A user with this email already exists' },
        testLocalizer('en').t,
      ),
      'A user with this email already exists.',
    );
  });
});

describe('AI features', () => {
  it('names the known features and still shows unknown ones', () => {
    const { t } = testLocalizer('es');
    assert.equal(
      aiFeatureCopy('transaction_categorization', t).label,
      'Clasificar movimientos',
    );
    assert.equal(
      aiFeatureCopy('receipt_parsing', testLocalizer('en').t).label,
      'Read receipts (OCR fallback)',
    );
    assert.deepEqual(aiFeatureCopy('future_feature', t), {
      label: 'future_feature',
      description: '',
    });
    assert.ok(needsPdfModel('statement_parsing'));
    assert.ok(!needsPdfModel('translation'));
  });
});
