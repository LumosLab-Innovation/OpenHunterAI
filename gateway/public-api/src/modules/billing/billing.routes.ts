import { Router, type Request, type Response } from 'express';
import express from 'express';
import { getPrisma } from '@x-hunter/db';
import { requireUser } from '../../middlewares/auth.middleware.js';
import { asyncRoute } from '../../middlewares/async-route.middleware.js';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { BillingService } from './billing.service.js';
import { verifySePayAuth, verifySePayHmac, type SePayWebhookBody } from './sepay.js';
import { verifyPolarSignature, type PolarWebhookBody } from './polar.js';
import { PolarService, PolarError } from './polar-checkout.service.js';
import { findSePayTopupOption } from './sepay-catalog.js';

export const billingRoutes = Router();
const billing = new BillingService();
const polar = new PolarService();
const prisma = getPrisma();

/**
 * SePay webhook. Authenticated by the shared API key header (and optional HMAC
 * when configured). Uses the raw body so HMAC verification matches byte-for-byte.
 * Always returns 200 on a well-formed-but-ignored event so SePay does not retry
 * a benign no-op forever; returns 401 only on auth failure.
 */
billingRoutes.post('/webhooks/sepay', express.raw({ type: '*/*' }), asyncRoute(async (req: Request, res: Response) => {
  const rawBody = (req.body as Buffer).toString('utf8');
  if (!verifySePayAuth(req.header('authorization'), process.env.SEPAY_WEBHOOK_APIKEY)) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED' } });
    return;
  }
  if (!verifySePayHmac(rawBody, req.header('x-sepay-signature'), process.env.SEPAY_WEBHOOK_SECRET)) {
    res.status(401).json({ error: { code: 'BAD_SIGNATURE' } });
    return;
  }
  let body: SePayWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: { code: 'BAD_BODY' } });
    return;
  }
  const result = await billing.handleSePay(body);
  res.status(200).json(result);
}));

/**
 * Polar webhook. Verified with the Standard Webhooks signature scheme over the
 * raw body. Returns 200 on processed/ignored, 401 on bad signature.
 */
billingRoutes.post('/webhooks/polar', express.raw({ type: '*/*' }), asyncRoute(async (req: Request, res: Response) => {
  const rawBody = (req.body as Buffer).toString('utf8');
  const webhookId = req.header('webhook-id');
  if (
    !verifyPolarSignature({
      rawBody,
      webhookId,
      webhookTimestamp: req.header('webhook-timestamp'),
      webhookSignature: req.header('webhook-signature'),
      secret: process.env.POLAR_WEBHOOK_SECRET,
    })
  ) {
    res.status(401).json({ error: { code: 'BAD_SIGNATURE' } });
    return;
  }
  let body: PolarWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: { code: 'BAD_BODY' } });
    return;
  }
  const result = await billing.handlePolar(body, webhookId!);
  res.status(200).json(result);
}));

/**
 * Creates a pending SePay top-up payment and returns the VietQR transfer details
 * the client should display. The embedded reference (OHAI<paymentId>) lets the
 * webhook match the incoming transfer back to this payment.
 */
billingRoutes.post('/billing/sepay/topup', requireUser, asyncRoute(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const optionId = String(req.body?.optionId ?? '');
  const option = findSePayTopupOption(process.env.SEPAY_TOPUP_OPTIONS, optionId);
  if (!option) {
    res.status(503).json({
      error: { code: 'TOPUP_OPTION_UNAVAILABLE', message: 'This top-up option is not configured' },
    });
    return;
  }
  const projectId = req.body?.projectId as string | undefined;
  if (!projectId) {
    res.status(400).json({ error: { code: 'PROJECT_REQUIRED' } });
    return;
  }
  const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: user.orgId } });
  if (!project) {
    res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND' } });
    return;
  }
  const payment = await prisma.payment.create({
    data: {
      organizationId: user.orgId,
      projectId,
      provider: 'sepay',
      providerRef: `pending-${Date.now()}`,
      amount: option.amount,
      currency: 'VND',
      status: 'pending',
      creditDelta: option.credits,
      metadata: { optionId: option.id },
    },
  });
  const account = process.env.SEPAY_ACCOUNT_NUMBER || '';
  const bank = process.env.SEPAY_BANK || '';
  res.status(201).json({
    paymentId: payment.id,
    transfer: {
      account,
      bank,
      amount: option.amount,
      // The client renders this as the transfer description / VietQR memo.
      content: `OHAI${payment.id}`,
    },
  });
}));

/**
 * Creates a Polar hosted checkout session for a subscription tier. The
 * org/project are taken from the authenticated session and embedded as Polar
 * metadata so the webhook can map the resulting subscription back. Returns the
 * hosted checkout URL for the client to redirect to.
 */
billingRoutes.post('/billing/polar/checkout', requireUser, asyncRoute(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const tier = req.body?.tier as string | undefined;
  const projectId = req.body?.projectId as string | undefined;
  const successUrl = (req.body?.successUrl as string | undefined) || process.env.POLAR_DEFAULT_SUCCESS_URL;
  if (!tier) {
    res.status(400).json({ error: { code: 'TIER_REQUIRED' } });
    return;
  }
  if (!successUrl) {
    res.status(400).json({ error: { code: 'SUCCESS_URL_REQUIRED' } });
    return;
  }
  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, organizationId: user.orgId } });
    if (!project) {
      res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND' } });
      return;
    }
  }
  try {
    const checkout = await polar.createCheckout({ orgId: user.orgId, projectId, tier, successUrl });
    res.status(201).json({ checkoutUrl: checkout.url, checkoutId: checkout.id });
  } catch (err) {
    if (err instanceof PolarError) {
      const status = err.code === 'POLAR_NOT_CONFIGURED' ? 503 : 400;
      res.status(status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    res.status(502).json({ error: { code: 'POLAR_UNREACHABLE', message: (err as Error).message } });
  }
}));
