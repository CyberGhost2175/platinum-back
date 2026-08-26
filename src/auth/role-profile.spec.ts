import { ALL_CRUD } from '../common/constants/permissions';
import { UserRole } from '../common/enums/user-role.enum';
import { permissionsFor, ROLE_META } from './role-profile';

describe('role profile', () => {
  it('gives admin directory CRUD and Russian workspace copy', () => {
    const permissions = permissionsFor(UserRole.ADMIN);
    expect(permissions.users).toEqual(ALL_CRUD);
    expect(permissions.settings).toEqual(ALL_CRUD);
    expect(ROLE_META[UserRole.ADMIN].label).toBe('Администратор');
    expect(ROLE_META[UserRole.ADMIN].nav.map((item) => item.id)).toEqual(
      expect.arrayContaining(['users', 'locations', 'suppliers']),
    );
  });

  it('hides staff and settings from cashier', () => {
    const permissions = permissionsFor(UserRole.CASHIER);
    expect(permissions.users).toBeUndefined();
    expect(permissions.settings).toBeUndefined();
    expect(ROLE_META[UserRole.CASHIER].nav[0].href).toBe('/pos');
  });
});
