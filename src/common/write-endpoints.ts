import {
  CrudAction,
  PermissionResource,
} from './constants/permissions';
import { UserRole } from './enums/user-role.enum';

export const SHIFT_ACCESS_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.STORE_MANAGER,
  UserRole.CASHIER,
];

/** Write HTTP endpoints used to assert the access matrix in tests and Swagger. */
export const WRITE_ENDPOINTS: ReadonlyArray<{
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  resource: PermissionResource;
  action: CrudAction;
}> = [
  {
    method: 'POST',
    path: '/api/products',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.CREATE,
  },
  {
    method: 'PATCH',
    path: '/api/products/:id',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.UPDATE,
  },
  {
    method: 'PATCH',
    path: '/api/products/:id/price',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.UPDATE,
  },
  {
    method: 'DELETE',
    path: '/api/products/:id',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.DELETE,
  },
  {
    method: 'PATCH',
    path: '/api/items/:id/status',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.UPDATE,
  },
  {
    method: 'POST',
    path: '/api/items/:id/move',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.UPDATE,
  },
  {
    method: 'PATCH',
    path: '/api/inventory/:id/status',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.UPDATE,
  },
  {
    method: 'POST',
    path: '/api/batches',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.CREATE,
  },
  {
    method: 'POST',
    path: '/api/stock-checks',
    resource: PermissionResource.PRODUCTS_INVENTORY,
    action: CrudAction.CREATE,
  },
  {
    method: 'POST',
    path: '/api/sales/drafts',
    resource: PermissionResource.SALES,
    action: CrudAction.CREATE,
  },
  {
    method: 'PATCH',
    path: '/api/sales/drafts/:id',
    resource: PermissionResource.SALES,
    action: CrudAction.CREATE,
  },
  {
    method: 'POST',
    path: '/api/sales/drafts/:id/items',
    resource: PermissionResource.SALES,
    action: CrudAction.CREATE,
  },
  {
    method: 'PATCH',
    path: '/api/sales/drafts/:id/items/:lineId',
    resource: PermissionResource.SALES,
    action: CrudAction.CREATE,
  },
  {
    method: 'DELETE',
    path: '/api/sales/drafts/:id/items/:lineId',
    resource: PermissionResource.SALES,
    action: CrudAction.CREATE,
  },
  {
    method: 'DELETE',
    path: '/api/sales/drafts/:id',
    resource: PermissionResource.SALES,
    action: CrudAction.CREATE,
  },
  {
    method: 'POST',
    path: '/api/sales/drafts/:id/pay',
    resource: PermissionResource.SALES,
    action: CrudAction.CREATE,
  },
  {
    method: 'POST',
    path: '/api/sales/:id/refund',
    resource: PermissionResource.SALES,
    action: CrudAction.UPDATE,
  },
  {
    method: 'POST',
    path: '/api/users',
    resource: PermissionResource.USERS,
    action: CrudAction.CREATE,
  },
  {
    method: 'PATCH',
    path: '/api/users/:id',
    resource: PermissionResource.USERS,
    action: CrudAction.UPDATE,
  },
  {
    method: 'PATCH',
    path: '/api/users/:id/password',
    resource: PermissionResource.USERS,
    action: CrudAction.UPDATE,
  },
  {
    method: 'DELETE',
    path: '/api/users/:id',
    resource: PermissionResource.USERS,
    action: CrudAction.DELETE,
  },
  {
    method: 'POST',
    path: '/api/suppliers',
    resource: PermissionResource.SETTINGS,
    action: CrudAction.CREATE,
  },
  {
    method: 'PATCH',
    path: '/api/suppliers/:id',
    resource: PermissionResource.SETTINGS,
    action: CrudAction.UPDATE,
  },
  {
    method: 'DELETE',
    path: '/api/suppliers/:id',
    resource: PermissionResource.SETTINGS,
    action: CrudAction.DELETE,
  },
  {
    method: 'POST',
    path: '/api/locations',
    resource: PermissionResource.SETTINGS,
    action: CrudAction.CREATE,
  },
  {
    method: 'PATCH',
    path: '/api/locations/:id',
    resource: PermissionResource.SETTINGS,
    action: CrudAction.UPDATE,
  },
  {
    method: 'DELETE',
    path: '/api/locations/:id',
    resource: PermissionResource.SETTINGS,
    action: CrudAction.DELETE,
  },
];
