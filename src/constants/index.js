// Application constants
export const APP_NAME = 'SmartServe';

// API endpoints
export const API_ENDPOINTS = {
  ORDERS: '/orders',
  MENU: '/menu',
  USERS: '/users',
  TABLES: '/tables'
};

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  WAITER: 'waiter',
  CHEF: 'chef',
  CASHIER: 'cashier'
};

// Order statuses
export const ORDER_STATUS = {
  PENDING: 'pending',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Table statuses
export const TABLE_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  MAINTENANCE: 'maintenance'
};

// Menu categories
export const MENU_CATEGORIES = {
  STARTERS: 'Starters',
  MAINS: 'Main Course',
  DESSERTS: 'Desserts',
  BEVERAGES: 'Beverages',
  SPECIALS: 'Today\'s Special'
};
