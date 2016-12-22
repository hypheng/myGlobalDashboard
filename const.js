const CATEGORY = {
  APPLIANCES: 'appliances',
  SERVER_HARDWARE: 'server-hardware',
  SERVER_PROFILES: 'server-profiles',
  ENCLOSURES: 'enclosures',
  ALERTS: 'alerts',
  USER_PROFILES: 'user-profiles',
  CONVERGED_SYSTEMS: 'converged-systems',
  FIRMWARE_DRIVERS: 'firmware-drivers',
  GROUPS: 'groups',
  STORAGE_POOLS: 'storage-pools',
  STORAGE_SYSTEMS: 'storage-systems',
  STORAGE_VOLUMES: 'storage-volumes',
  SAN_MANAGERS: 'san-managers',
  MANAGED_SANS: 'managed-sans',
  VIEW_SETTINGS: 'view-settings',
};

const GD_OV_CATEGORY_MAP = {
  'server-hardware': 'server-hardware',
  'server-profiles': 'server-profiles',
  enclosures: 'enclosures',
  alerts: 'alerts',
  'firmware-drivers': 'firmware-drivers',
  'storage-pools': 'storage-pools',
  'storage-systems': 'storage-systems',
  'storage-volumes': 'storage-volumes',
  'san-managers': 'fc-sans/device-managers',
  'managed-sans': 'fc-sans/managed-sans',
};

module.exports = {
  CATEGORY,
  GD_OV_CATEGORY_MAP,
};
