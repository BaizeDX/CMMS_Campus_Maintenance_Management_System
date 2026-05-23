export type RoleKey = 'administrator' | 'executive_officer' | 'mid_level_manager' | 'base_level_worker';

export interface RolePermissions {
  canViewTableManager: boolean;
  canCreateRecord: boolean;
  canBulkInsert: boolean;
  canEditRecord: boolean;
  canDeleteRecord: boolean;
  canRunSql: boolean;
}

export interface RoleDefinition {
  key: RoleKey;
  label: string;
  description: string;
  summary: string;
  allowedViews: Array<'dashboard' | 'data-console'>;
  dataConsoleTabs: Array<'tables' | 'cleaning' | 'sql' | 'reports'>;
  permissions: RolePermissions;
  highlights: string[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'administrator',
    label: 'System Administrator',
    description: 'System-level DBA-style actor with full platform access, separate from the operational staff hierarchy.',
    summary: 'Full access to data management, reports, SQL runner, and bulk operations.',
    allowedViews: ['dashboard', 'data-console'],
    dataConsoleTabs: ['tables', 'cleaning', 'reports', 'sql'],
    permissions: {
      canViewTableManager: true,
      canCreateRecord: true,
      canBulkInsert: true,
      canEditRecord: true,
      canDeleteRecord: true,
      canRunSql: true
    },
    highlights: [
      'Maintain every master table (Staff / Activity / Equipment / etc.)',
      'Review the same reporting surfaces available to executive users',
      'Execute unrestricted SQL statements',
      'Bulk import or update mission-critical datasets'
    ]
  },
  {
    key: 'executive_officer',
    label: 'Executive Officer',
    description: 'Business-facing reviewer focused on macro KPIs and campus-wide status, without system administration privileges.',
    summary: 'Read-only access dedicated to reports and cleaning schedules.',
    allowedViews: ['dashboard', 'data-console'],
    dataConsoleTabs: ['reports', 'cleaning'],
    permissions: {
      canViewTableManager: false,
      canCreateRecord: false,
      canBulkInsert: false,
      canEditRecord: false,
      canDeleteRecord: false,
      canRunSql: false
    },
    highlights: [
      'Review executive KPIs and analytics',
      'Inspect cleaning plans and building availability',
      'No low-level mutations, ensuring governance'
    ]
  },
  {
    key: 'mid_level_manager',
    label: 'Mid-level Manager',
    description: 'Oversees buildings, crews, and equipment; needs CRUD plus bulk tools without raw SQL access.',
    summary: 'UI-driven maintenance with batch insertion, SQL terminal disabled.',
    allowedViews: ['dashboard', 'data-console'],
    dataConsoleTabs: ['tables', 'cleaning'],
    permissions: {
      canViewTableManager: true,
      canCreateRecord: true,
      canBulkInsert: true,
      canEditRecord: true,
      canDeleteRecord: true,
      canRunSql: false
    },
    highlights: [
      'Manage Staff/Activity/Equipment entities through the UI',
      'Plan tasks or import assets in batches',
      'Operates within pre-built workflows, no arbitrary SQL'
    ]
  },
  {
    key: 'base_level_worker',
    label: 'Base-level Worker',
    description: 'Frontline personnel referencing personal assignments and safety warnings.',
    summary: 'Read-only access centered on cleaning/maintenance schedules.',
    allowedViews: ['dashboard', 'data-console'],
    dataConsoleTabs: ['cleaning'],
    permissions: {
      canViewTableManager: false,
      canCreateRecord: false,
      canBulkInsert: false,
      canEditRecord: false,
      canDeleteRecord: false,
      canRunSql: false
    },
    highlights: [
      'Quickly review assigned rooms and chemical hazards',
      'Understand building lockdown windows',
      'No create/update/delete operations to preserve integrity'
    ]
  }
];

export const ROLE_MAP = ROLE_DEFINITIONS.reduce<Record<RoleKey, RoleDefinition>>((acc, role) => {
  acc[role.key] = role;
  return acc;
}, {} as Record<RoleKey, RoleDefinition>);
