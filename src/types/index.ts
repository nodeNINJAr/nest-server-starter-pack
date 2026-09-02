export interface IUserRole {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  role?: {
    id: string;
    name: string;
  };
}
