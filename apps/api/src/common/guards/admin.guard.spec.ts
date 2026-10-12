import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AdminGuard, isAdminEmail } from './admin.guard';
import { ForbiddenError } from '../exceptions/graphql-error.exception';

describe('AdminGuard', () => {
  const original = process.env.ADMIN_EMAILS;
  afterEach(() => {
    process.env.ADMIN_EMAILS = original;
    jest.restoreAllMocks();
  });

  it('matches emails from ADMIN_EMAILS, ignoring case and spaces', () => {
    process.env.ADMIN_EMAILS = ' Admin@Finnit.app , ops@finnit.app';
    expect(isAdminEmail('admin@finnit.app')).toBe(true);
    expect(isAdminEmail('OPS@finnit.app')).toBe(true);
    expect(isAdminEmail('user@finnit.app')).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it('denies everyone when ADMIN_EMAILS is empty', () => {
    process.env.ADMIN_EMAILS = '';
    expect(isAdminEmail('admin@finnit.app')).toBe(false);
  });

  it('blocks non-admin users', () => {
    process.env.ADMIN_EMAILS = 'admin@finnit.app';
    const contextFor = (email: string) => {
      jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
        getContext: () => ({ req: { user: { email } } }),
      } as unknown as GqlExecutionContext);
      return {} as ExecutionContext;
    };

    expect(new AdminGuard().canActivate(contextFor('admin@finnit.app'))).toBe(
      true,
    );
    expect(() =>
      new AdminGuard().canActivate(contextFor('user@finnit.app')),
    ).toThrow(ForbiddenError);
  });
});
