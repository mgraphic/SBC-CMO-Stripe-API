import { Router, Request, Response } from 'express';
import type Stripe from 'stripe';
import { dataStore } from '../store/dataStore';

type StripeProduct = Stripe.Product;
type StripePrice = Stripe.Price;

const router = Router();

function parseItems<T>(body: unknown): T[] {
    if (Array.isArray(body)) return body as T[];
    if (
        body &&
        typeof body === 'object' &&
        'data' in body &&
        Array.isArray((body as Record<string, unknown>).data)
    ) {
        return (body as { data: T[] }).data;
    }
    return [];
}

// ── Reload from files ─────────────────────────────────────────────────────────
router.post('/reload', (_req: Request, res: Response) => {
    dataStore.loadFromFiles();
    res.json({ success: true, message: 'Data reloaded from files.' });
});

// ── Bulk import products ──────────────────────────────────────────────────────
router.post('/products', (req: Request, res: Response) => {
    const items = parseItems<StripeProduct>(req.body);
    if (items.length === 0) {
        res.status(400).json({
            error: 'No valid product data found. Send a JSON array or a Stripe list response object.',
        });
        return;
    }
    const imported = dataStore.importProducts(items);
    res.json({ success: true, imported, type: 'product' });
});

// ── Bulk import prices ────────────────────────────────────────────────────────
router.post('/prices', (req: Request, res: Response) => {
    const items = parseItems<StripePrice>(req.body);
    if (items.length === 0) {
        res.status(400).json({
            error: 'No valid price data found. Send a JSON array or a Stripe list response object.',
        });
        return;
    }
    const imported = dataStore.importPrices(items);
    res.json({ success: true, imported, type: 'price' });
});

export default router;
