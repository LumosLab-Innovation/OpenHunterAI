import { describe, it, expect } from 'vitest';
import { verifySePayAuth, extractPaymentRef, sepayEventId, verifySePayHmac } from './sepay.js';
import { verifyPolarSignature, mapPolarProductToTier, mapPolarStatus, polarEventId } from './polar.js';
import { createHmac } from 'node:crypto';
import { findSePayTopupOption, parseSePayTopupCatalog } from './sepay-catalog.js';

describe('sepay', () => {
  it('uses only server-configured top-up amounts and credits', () => {
    const catalog = 'single_scan:990000:1,team_pack:4500000:5';
    expect(parseSePayTopupCatalog(catalog)).toEqual([
      { id: 'single_scan', amount: 990000, credits: 1 },
      { id: 'team_pack', amount: 4500000, credits: 5 },
    ]);
    expect(findSePayTopupOption(catalog, 'single_scan')).toEqual({
      id: 'single_scan',
      amount: 990000,
      credits: 1,
    });
    expect(findSePayTopupOption(catalog, 'client_supplied')).toBeNull();
  });

  it('verifies the Apikey header constant-time', () => {
    expect(verifySePayAuth('Apikey secret123', 'secret123')).toBe(true);
    expect(verifySePayAuth('apikey secret123', 'secret123')).toBe(true);
    expect(verifySePayAuth('secret123', 'secret123')).toBe(true);
    expect(verifySePayAuth('Apikey wrong', 'secret123')).toBe(false);
    expect(verifySePayAuth(undefined, 'secret123')).toBe(false);
    expect(verifySePayAuth('Apikey x', undefined)).toBe(false);
  });

  it('extracts the embedded payment reference', () => {
    expect(extractPaymentRef('Thanh toan OHAIabc123 cam on')).toBe('abc123');
    expect(extractPaymentRef('no ref here')).toBeNull();
    expect(extractPaymentRef(undefined)).toBeNull();
  });

  it('derives a stable idempotency id', () => {
    expect(sepayEventId({ id: 42, transferAmount: 1000 } as any)).toBe('sepay-42');
  });

  it('verifies optional HMAC and passes through when no secret', () => {
    const body = '{"a":1}';
    const sig = createHmac('sha256', 'shh').update(body).digest('hex');
    expect(verifySePayHmac(body, sig, 'shh')).toBe(true);
    expect(verifySePayHmac(body, 'bad', 'shh')).toBe(false);
    expect(verifySePayHmac(body, undefined, undefined)).toBe(true); // no secret configured
  });
});

describe('polar', () => {
  it('verifies a Standard Webhooks signature', () => {
    const secret = 'whsec_' + Buffer.from('topsecretkey').toString('base64');
    const id = 'msg_1';
    const ts = '1700000000';
    const body = '{"type":"order.paid"}';
    const secretBytes = Buffer.from('topsecretkey');
    const expected = createHmac('sha256', secretBytes).update(`${id}.${ts}.${body}`).digest('base64');

    expect(
      verifyPolarSignature({ rawBody: body, webhookId: id, webhookTimestamp: ts, webhookSignature: `v1,${expected}`, secret }),
    ).toBe(true);
    // Tampered body fails.
    expect(
      verifyPolarSignature({ rawBody: '{"type":"x"}', webhookId: id, webhookTimestamp: ts, webhookSignature: `v1,${expected}`, secret }),
    ).toBe(false);
    // Missing pieces fail.
    expect(
      verifyPolarSignature({ rawBody: body, webhookId: undefined, webhookTimestamp: ts, webhookSignature: `v1,${expected}`, secret }),
    ).toBe(false);
  });

  it('maps product id to tier', () => {
    const map = 'prod_a:ai_blackhat_mindset_check,prod_b:monitor_workspace';
    expect(mapPolarProductToTier('prod_a', map)).toBe('ai_blackhat_mindset_check');
    expect(mapPolarProductToTier('prod_b', map)).toBe('monitor_workspace');
    expect(mapPolarProductToTier('prod_unknown', map)).toBeNull();
    expect(mapPolarProductToTier(undefined, map)).toBeNull();
    expect(mapPolarProductToTier('prod_a', undefined)).toBeNull();
  });

  it('normalizes subscription status', () => {
    expect(mapPolarStatus('active')).toBe('active');
    expect(mapPolarStatus('trialing')).toBe('active');
    expect(mapPolarStatus('past_due')).toBe('past_due');
    expect(mapPolarStatus('canceled')).toBe('canceled');
    expect(mapPolarStatus('weird')).toBe('expired');
    expect(mapPolarStatus(undefined)).toBe('active');
  });

  it('derives idempotency id', () => {
    expect(polarEventId('msg_9')).toBe('polar-msg_9');
  });
});
