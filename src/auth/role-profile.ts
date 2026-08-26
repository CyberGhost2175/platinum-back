import { UserRole } from '../common/enums/user-role.enum';
import {
  CrudAction,
  PermissionResource,
  ROLE_PERMISSIONS,
} from '../common/constants/permissions';

export interface RoleNavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
}

export interface RoleMeta {
  label: string;
  title: string;
  description: string;
  accent: string;
  nav: RoleNavItem[];
}

export const ROLE_META: Record<UserRole, RoleMeta> = {
  [UserRole.ADMIN]: {
    label: 'Администратор',
    title: 'Управление сетью',
    description:
      'Полный доступ: сотрудники, склады, поставщики, каталог, касса и аналитика.',
    accent: '#1f4b8f',
    nav: [
      { id: 'dashboard', label: 'Сводка', href: '/admin', icon: 'layout' },
      { id: 'users', label: 'Сотрудники', href: '/admin/users', icon: 'users' },
      { id: 'locations', label: 'Склады и салоны', href: '/admin/locations', icon: 'warehouse' },
      { id: 'suppliers', label: 'Поставщики', href: '/admin/suppliers', icon: 'truck' },
      { id: 'products', label: 'Товары', href: '/admin/products', icon: 'gem' },
      { id: 'analytics', label: 'Аналитика', href: '/analytics', icon: 'chart' },
    ],
  },
  [UserRole.STORE_MANAGER]: {
    label: 'Управляющий салоном',
    title: 'Салон',
    description:
      'Остатки и персонал своей точки, сторно чеков, отчёты по салону.',
    accent: '#0f766e',
    nav: [
      { id: 'dashboard', label: 'Салон', href: '/store', icon: 'store' },
      { id: 'sales', label: 'Чеки', href: '/sales', icon: 'receipt' },
      { id: 'inventory', label: 'Остатки', href: '/inventory', icon: 'boxes' },
      { id: 'catalog', label: 'Каталог', href: '/catalog', icon: 'gem' },
      { id: 'analytics', label: 'Отчёты', href: '/analytics', icon: 'chart' },
    ],
  },
  [UserRole.CASHIER]: {
    label: 'Кассир',
    title: 'Касса',
    description: 'Смена, продажа по бирке или артикулу, клиенты салона.',
    accent: '#b45309',
    nav: [
      { id: 'pos', label: 'Касса', href: '/pos', icon: 'cash-register' },
      { id: 'shift', label: 'Смена', href: '/shifts/current', icon: 'clock' },
      { id: 'catalog', label: 'Поиск', href: '/catalog', icon: 'search' },
      { id: 'customers', label: 'Клиенты', href: '/customers', icon: 'heart' },
    ],
  },
  [UserRole.ONLINE_MANAGER]: {
    label: 'Менеджер онлайн',
    title: 'Интернет-магазин',
    description: 'Заказы с сайта, клиенты и аналитика канала online.',
    accent: '#6d28d9',
    nav: [
      { id: 'orders', label: 'Заказы', href: '/orders', icon: 'package' },
      { id: 'catalog', label: 'Витрина', href: '/catalog', icon: 'gem' },
      { id: 'customers', label: 'Клиенты', href: '/customers', icon: 'heart' },
      { id: 'analytics', label: 'Online-отчёты', href: '/analytics', icon: 'chart' },
    ],
  },
  [UserRole.WAREHOUSE]: {
    label: 'Кладовщик',
    title: 'Склад',
    description: 'Приёмка партий, перемещения, статусы изделий, инвентаризация.',
    accent: '#334155',
    nav: [
      { id: 'batches', label: 'Приёмка', href: '/warehouse/batches', icon: 'inbox' },
      { id: 'items', label: 'Изделия', href: '/warehouse/items', icon: 'tag' },
      { id: 'stock-checks', label: 'Ревизия', href: '/warehouse/stock-checks', icon: 'clipboard' },
      { id: 'catalog', label: 'Номенклатура', href: '/catalog', icon: 'gem' },
    ],
  },
};

export function permissionsFor(role: UserRole) {
  const out: Record<string, CrudAction[]> = {};
  for (const resource of Object.values(PermissionResource)) {
    const actions = ROLE_PERMISSIONS[resource][role];
    if (actions?.length) {
      out[resource] = actions;
    }
  }
  return out;
}
