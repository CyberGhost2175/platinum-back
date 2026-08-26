import { UserRole } from '../enums/user-role.enum';
import { AuthUser } from '../../auth/types/auth.types';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: UserRole;
  }
}

export {};
