import { can } from './permissions';

describe('can', () => {
  it('grants DIRECTOR every permission', () => {
    expect(can('DIRECTOR', 'finance:read')).toBe(true);
    expect(can('DIRECTOR', 'audit:read')).toBe(true);
    expect(can('DIRECTOR', 'users:delete')).toBe(true);
  });

  it('grants SELLER the spec allow-list', () => {
    expect(can('SELLER', 'orders:create')).toBe(true);
    expect(can('SELLER', 'reviews:read')).toBe(true);
    expect(can('SELLER', 'warehouse:read')).toBe(true);
  });

  it('denies SELLER the director-only modules and actions', () => {
    expect(can('SELLER', 'finance:read')).toBe(false);
    expect(can('SELLER', 'analytics:read')).toBe(false);
    expect(can('SELLER', 'users:read')).toBe(false);
    expect(can('SELLER', 'audit:read')).toBe(false);
    expect(can('SELLER', 'discounts:approve')).toBe(false);
    expect(can('SELLER', 'reviews:update')).toBe(false);
    expect(can('SELLER', 'warehouse:create')).toBe(false);
  });

  it('denies SELLER the two deliberately director-only delete keys', () => {
    // products.controller.ts's hard-delete/import/export and the unscoped
    // customers.controller.ts's DELETE stay director-only even though the
    // spec otherwise grants SELLER full CRUD on both modules — see
    // permissions.ts's own comments on why these two keys are the exception.
    expect(can('SELLER', 'products:delete')).toBe(false);
    expect(can('SELLER', 'customers:delete')).toBe(false);
  });

  it('fails closed for an unrecognized role value rather than throwing', () => {
    expect(
      can('MANAGER' as unknown as Parameters<typeof can>[0], 'orders:read'),
    ).toBe(false);
  });
});
