// Roles de la plataforma.
// - super_admin: administrador global (registro en `systemAdmins`). Ve y
//   administra todos los workspaces. NO se asigna desde la interfaz.
// - distributor: dueño del workspace (la "distribución"). Administra dentro de
//   su propio workspace, nunca fuera.
// - salesperson / reviewer: roles que ya existían; se conservan tal cual.
export type UserRole = "super_admin" | "distributor" | "salesperson" | "reviewer";

export type UserProfile = {
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  /** Workspace ACTIVO del usuario. Lo escribe solo el servidor. */
  organizationId?: string | null;
  isTestUser: boolean;
  active: boolean;
};

/** Workspace. En Firestore sigue siendo la colección `organizations`. */
export type Workspace = {
  id: string;
  name: string;
  active: boolean;
  createdBy?: string | null;
  createdAt?: string | null;
};

/** Membresía. En Firestore sigue siendo la colección `organizationMembers`. */
export type Membership = {
  id: string;
  organizationId: string;
  organizationName?: string;
  role: UserRole;
  active: boolean;
};

/** Fila de la lista de usuarios del panel de administración. */
export type AdminUserRow = {
  uid: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  activeWorkspaceId: string | null;
  isSuperAdmin: boolean;
  memberships: Membership[];
};
