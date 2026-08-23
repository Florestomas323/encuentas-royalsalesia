export type UserRole = "distributor" | "salesperson" | "reviewer";

export type UserProfile = {
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  organizationId?: string | null;
  isTestUser: boolean;
  active: boolean;
};
