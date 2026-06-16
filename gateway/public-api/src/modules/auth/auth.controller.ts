import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

const service = new AuthService();

export async function signUp(req: Request, res: Response) {
  const result = await service.signUp(req.body, res);
  res.status(result.status).json(result.body);
}

export async function signIn(req: Request, res: Response) {
  const result = await service.signIn(req.body, res);
  res.status(result.status).json(result.body);
}

export async function signOut(req: Request, res: Response) {
  res.json(await service.signOut(req, res));
}

export function me(req: Request, res: Response) {
  const user = req.user!;
  res.json({ user: { ...user, id: user.userId } });
}
