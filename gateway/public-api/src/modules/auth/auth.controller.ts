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

export function signOut(_req: Request, res: Response) {
  res.json(service.signOut(res));
}

export function me(req: Request, res: Response) {
  res.json({ user: req.user });
}
