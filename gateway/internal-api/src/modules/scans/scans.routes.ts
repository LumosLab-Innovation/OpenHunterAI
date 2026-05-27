import { Router } from 'express';

export const scanRoutes = Router();

scanRoutes.post('/:id/steps', (req, res) => {
  res.status(202).json({ accepted: true, scanId: req.params.id, payload: req.body });
});

scanRoutes.post('/:id/findings', (req, res) => {
  res.status(202).json({ accepted: true, scanId: req.params.id, payload: req.body });
});
