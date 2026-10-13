import { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AdminGuard, MasterGuard } from './admin.guard';
import { ForbiddenError } from '../exceptions/graphql-error.exception';

describe('admin guards', () => {
  afterEach(() => jest.restoreAllMocks());

  const contextFor = (user?: { role: string; isMaster?: boolean }) => {
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({ req: { user } }),
    } as unknown as GqlExecutionContext);
    return {} as ExecutionContext;
  };

  it('AdminGuard lets admins through and blocks everyone else', () => {
    expect(new AdminGuard().canActivate(contextFor({ role: 'admin' }))).toBe(
      true,
    );
    expect(() =>
      new AdminGuard().canActivate(contextFor({ role: 'user' })),
    ).toThrow(ForbiddenError);
    expect(() => new AdminGuard().canActivate(contextFor())).toThrow(
      ForbiddenError,
    );
  });

  it('MasterGuard lets only the master through', () => {
    expect(
      new MasterGuard().canActivate(
        contextFor({ role: 'admin', isMaster: true }),
      ),
    ).toBe(true);
    expect(() =>
      new MasterGuard().canActivate(contextFor({ role: 'admin' })),
    ).toThrow(ForbiddenError);
    // isMaster without the admin role (should never happen) is not enough.
    expect(() =>
      new MasterGuard().canActivate(
        contextFor({ role: 'user', isMaster: true }),
      ),
    ).toThrow(ForbiddenError);
  });
});
