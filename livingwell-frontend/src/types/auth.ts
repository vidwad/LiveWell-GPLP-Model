export type UserRole =
  | "DEVELOPER"
  | "GP_ADMIN"
  | "OPERATIONS_MANAGER"
  | "PROPERTY_MANAGER"
  | "INVESTOR"
  | "PARTNER"
  | "RESIDENT";

export interface User {
  user_id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserCreate {
  email: string;
  password: string;
  full_name?: string;
  role: UserRole;
}
