import { UserRole } from '../enums/user-role.enum';

export enum CrudAction {
  CREATE = 'C',
  READ = 'R',
  UPDATE = 'U',
  DELETE = 'D',
}

export enum PermissionResource {
  PRODUCTS_INVENTORY = 'products_inventory',
  SALES = 'sales',
  ONLINE_ORDERS = 'online_orders',
  CUSTOMERS = 'customers',
  USERS = 'users',
  CATALOG = 'catalog',
  ANALYTICS = 'analytics',
  SETTINGS = 'settings',
}

export const ALL_CRUD: CrudAction[] = [
  CrudAction.CREATE,
  CrudAction.READ,
  CrudAction.UPDATE,
  CrudAction.DELETE,
];

/**
 * Access matrix from the CRM specification.
 * Extra semantics (returns-only update, store-scoped analytics) live in services.
 */
export const ROLE_PERMISSIONS: Record<
  PermissionResource,
  Partial<Record<UserRole, CrudAction[]>>
> = {
  [PermissionResource.PRODUCTS_INVENTORY]: {
    admin: ALL_CRUD,
    store_manager: ALL_CRUD,
    cashier: [CrudAction.READ],
    online_manager: [CrudAction.READ],
    warehouse: [CrudAction.CREATE, CrudAction.READ, CrudAction.UPDATE],
  },
  [PermissionResource.SALES]: {
    admin: ALL_CRUD,
    store_manager: [CrudAction.READ, CrudAction.UPDATE],
    cashier: [CrudAction.CREATE, CrudAction.READ],
    online_manager: [CrudAction.READ],
  },
  [PermissionResource.ONLINE_ORDERS]: {
    admin: ALL_CRUD,
    store_manager: [CrudAction.READ],
    online_manager: ALL_CRUD,
    warehouse: [CrudAction.READ],
  },
  [PermissionResource.CUSTOMERS]: {
    admin: ALL_CRUD,
    store_manager: [CrudAction.READ, CrudAction.UPDATE],
    cashier: [CrudAction.CREATE, CrudAction.READ],
    online_manager: [CrudAction.CREATE, CrudAction.READ, CrudAction.UPDATE],
  },
  [PermissionResource.USERS]: {
    admin: ALL_CRUD,
  },
  [PermissionResource.CATALOG]: {
    admin: ALL_CRUD,
    store_manager: [CrudAction.READ, CrudAction.UPDATE],
    cashier: [CrudAction.READ],
    online_manager: [CrudAction.READ],
    warehouse: [CrudAction.READ],
  },
  [PermissionResource.ANALYTICS]: {
    admin: [CrudAction.READ],
    store_manager: [CrudAction.READ],
    online_manager: [CrudAction.READ],
  },
  [PermissionResource.SETTINGS]: {
    admin: ALL_CRUD,
  },
};

export function hasPermission(
  role: UserRole,
  resource: PermissionResource,
  action: CrudAction,
): boolean {
  return ROLE_PERMISSIONS[resource][role]?.includes(action) ?? false;
}

export function rolesWithPermission(
  resource: PermissionResource,
  action: CrudAction,
): UserRole[] {
  return (Object.values(UserRole) as UserRole[]).filter((role) =>
    hasPermission(role, resource, action),
  );
}

export const TOTP_REQUIRED_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.ADMIN,
  UserRole.STORE_MANAGER,
]);

export function totpRequiredFor(role: UserRole): boolean {
  return TOTP_REQUIRED_ROLES.has(role);
}
