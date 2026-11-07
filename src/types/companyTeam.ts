export const TEAM_ENDPOINT = '/api/company-team';
export const TEAM_ROLES = { owner: 'Propietario', admin: 'Administrador', accountant: 'Contador', billing: 'Facturador' } as const;
export type TeamRole = keyof typeof TEAM_ROLES;
export type AssignableRole = Exclude<TeamRole, 'owner'>;

export interface TeamMember {
  id: string;
  email: string | null;
  role: TeamRole;
  editable: boolean;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: AssignableRole;
  expiresAt: string;
  delivery: 'unconfirmed' | 'sent' | 'failed';
  editable: boolean;
}

export interface CompanyTeam {
  role: 'owner' | 'admin';
  members: TeamMember[];
  invitations: TeamInvitation[];
}

export interface OpenInvitation {
  companyId: string;
  companyName: string;
  role: AssignableRole;
  accepted: boolean;
}

export type TeamCommand = { action: 'invite'; email: string; role: AssignableRole }
  | { action: 'role'; targetId: string; role: AssignableRole }
  | { action: 'cancel' | 'remove'; targetId: string };

export function isTeamId(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value);
}

export function isAssignableRole(value: unknown): value is AssignableRole {
  return value === 'admin' || value === 'accountant' || value === 'billing';
}
