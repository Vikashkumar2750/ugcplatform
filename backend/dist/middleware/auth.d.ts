import { Request, Response, NextFunction } from "express";
export interface AuthenticatedRequest extends Request {
    userId: string;
    userEmail: string;
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requireAdmin(req: Request, res: Response, next: NextFunction): void;
