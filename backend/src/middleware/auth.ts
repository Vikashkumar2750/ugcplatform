import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// Anon key client — only used to verify JWT tokens
const anonClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AuthenticatedRequest extends Request {
  userId: string;
  userEmail: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.replace("Bearer ", "");

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as AuthenticatedRequest).userId = data.user.id;
  (req as AuthenticatedRequest).userEmail = data.user.email ?? "";
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminEmail = process.env.ADMIN_EMAIL!;
  const userEmail = (req as AuthenticatedRequest).userEmail;
  if (userEmail !== adminEmail) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
