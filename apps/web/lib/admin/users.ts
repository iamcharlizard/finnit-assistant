/** Admin panel, users: GraphQL documents, types and pure helpers. */

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'disabled';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isMaster: boolean;
  status: UserStatus;
  hasPassword: boolean;
  hasGoogle: boolean;
  lastLoginAt: string | null;
  invitedByName: string | null;
  createdAt: string;
}

export interface AdminUsersPage {
  adminUsers: {
    totalCount: number;
    edges: { node: AdminUser }[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  };
}

/** Must match the API's MIN_PASSWORD_LENGTH. */
export const MIN_PASSWORD_LENGTH = 10;
export const USERS_PAGE_SIZE = 25;

const USER_FIELDS =
  'id name email role isMaster status hasPassword hasGoogle lastLoginAt invitedByName createdAt';

export const ADMIN_USERS_QUERY = `query AdminUsers($first: Int, $after: String, $search: String, $status: UserStatus, $role: UserRole) {
  adminUsers(first: $first, after: $after, search: $search, status: $status, role: $role) {
    totalCount
    edges { node { ${USER_FIELDS} } }
    pageInfo { endCursor hasNextPage }
  }
}`;

export const CREATE_USER_MUTATION = `mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) { ${USER_FIELDS} } }`;

export const SET_USER_PASSWORD_MUTATION = `mutation SetUserPassword($id: ID!, $input: SetUserPasswordInput!) { setUserPassword(id: $id, input: $input) { ${USER_FIELDS} } }`;

/** Mutations that take only the user id, by the action that runs them. */
export const USER_ACTION_MUTATIONS = {
  removePassword: `mutation RemoveUserPassword($id: ID!) { result: removeUserPassword(id: $id) { ${USER_FIELDS} } }`,
  unlinkGoogle: `mutation UnlinkUserGoogle($id: ID!) { result: unlinkUserGoogle(id: $id) { ${USER_FIELDS} } }`,
  disable: `mutation DisableUser($id: ID!) { result: disableUser(id: $id) { ${USER_FIELDS} } }`,
  enable: `mutation EnableUser($id: ID!) { result: enableUser(id: $id) { ${USER_FIELDS} } }`,
  makeAdmin: `mutation MakeAdmin($id: ID!) { result: updateUser(id: $id, input: { role: admin }) { ${USER_FIELDS} } }`,
  removeAdmin: `mutation RemoveAdmin($id: ID!) { result: updateUser(id: $id, input: { role: user }) { ${USER_FIELDS} } }`,
} as const;

export type UserAction = keyof typeof USER_ACTION_MUTATIONS | 'setPassword';

export const ROLE_LABELS = {
  master: 'Maestro',
  admin: 'Administrador',
  user: 'Usuario',
} as const;

export function roleLabel(user: Pick<AdminUser, 'role' | 'isMaster'>): string {
  return user.isMaster ? ROLE_LABELS.master : ROLE_LABELS[user.role];
}

/** Which row actions the signed-in admin may use on `target` (the API enforces the same rules). */
export function availableActions(
  target: AdminUser,
  me: { id: string; isMaster: boolean },
): UserAction[] {
  // Only the master changes the master's account.
  if (target.isMaster && target.id !== me.id) return [];
  const actions: UserAction[] = ['setPassword'];
  if (target.hasGoogle && target.hasPassword) actions.push('removePassword');
  if (target.hasGoogle) actions.push('unlinkGoogle');
  if (me.isMaster && !target.isMaster) {
    actions.push(target.role === 'admin' ? 'removeAdmin' : 'makeAdmin');
  }
  if (!target.isMaster && target.id !== me.id) {
    actions.push(target.status === 'active' ? 'disable' : 'enable');
  }
  return actions;
}

const PASSWORD_SETS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%*-_+=?',
];

/** Unbiased random index below `max` (rejection sampling). */
function randomIndex(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer);
  while (buffer[0]! >= limit);
  return buffer[0]! % max;
}

/**
 * A strong random password: 16 characters with upper and lower case,
 * digits and symbols, without look-alikes (O/0, l/1) so it can be dictated.
 */
export function generatePassword(length = 16): string {
  const all = PASSWORD_SETS.join('');
  const chars = PASSWORD_SETS.map((set) => set[randomIndex(set.length)]!);
  while (chars.length < length) chars.push(all[randomIndex(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** dd/mm/yyyy in local time, without Intl (same output on every runtime). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** "hace 5 min", "ayer", … and dd/mm/yyyy after a week. */
export function formatLastSignIn(iso: string | null, now = Date.now()): string {
  if (!iso) return 'Nunca';
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Hace un momento';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  return formatDate(iso);
}
