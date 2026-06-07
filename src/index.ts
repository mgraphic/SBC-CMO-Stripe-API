import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import productRoutes from './routes/products';
import priceRoutes from './routes/prices';
import checkoutRoutes from './routes/checkout';
import importRoutes from './routes/import';
import { validateApiKey } from './middleware/auth';
import { notFound, errorHandler } from './middleware/errorHandler';
import { dataStore } from './store/dataStore';
import { renderMockCheckout, renderNotFound } from './views/mockCheckout';
import { dispatchCheckoutWebhooks } from './utils/webhook';

const app = express();
const PORT = process.env.PORT ?? 4242;

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan('dev'));
// Accept both JSON and form-encoded bodies (Stripe SDKs use form-encoded)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Health check (no auth required) ──────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'sbc-cmo-stripe-mock-api' });
});

// ── Mock checkout page (no auth) ──────────────────────────────────────────────
app.get('/checkout/mock-payment', (req, res) => {
    const sessionId = req.query.session_id as string | undefined;
    const session = sessionId ? dataStore.getSession(sessionId) : undefined;

    if (!session) {
        res.status(404).send(renderNotFound(sessionId));
        return;
    }

    const lineItems = dataStore.getSessionLineItems(session.id);
    res.send(renderMockCheckout(session, lineItems));
});

// ── Simulate payment completion (no auth) ─────────────────────────────────────
app.post('/checkout/mock-payment', (req, res) => {
    const sessionId = req.body?.session_id as string | undefined;
    const session = sessionId ? dataStore.getSession(sessionId) : undefined;

    if (!session) {
        res.status(404).send(renderNotFound(sessionId));
        return;
    }

    if (session.status !== 'open') {
        res.redirect(session.success_url ?? '/');
        return;
    }

    const completed = {
        ...session,
        status: 'complete' as const,
        payment_status: 'paid' as const,
    };
    dataStore.setSession(completed);

    // Fire webhooks asynchronously — do not block the redirect
    dispatchCheckoutWebhooks(completed).catch((err: unknown) => {
        console.error('[webhook] Dispatch error:', (err as Error).message);
    });

    res.redirect(session.success_url ?? '/');
});

// ── Stripe API routes (auth required) ────────────────────────────────────────
app.use('/v1', validateApiKey);
app.use('/v1/products', productRoutes);
app.use('/v1/prices', priceRoutes);
app.use('/v1/checkout/sessions', checkoutRoutes);
app.use('/v1/import', importRoutes);

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[server] Stripe Mock API running on http://localhost:${PORT}`);
    console.log(`[server] Health:    GET  http://localhost:${PORT}/health`);
    console.log(
        `[server] Products:  GET  http://localhost:${PORT}/v1/products`,
    );
    console.log(`[server] Prices:    GET  http://localhost:${PORT}/v1/prices`);
    console.log(
        `[server] Checkout:  POST http://localhost:${PORT}/v1/checkout/sessions`,
    );
});

export default app;
