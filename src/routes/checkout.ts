import { Router, Request, Response } from 'express';
import type Stripe from 'stripe';
import { dataStore } from '../store/dataStore';
import {
    generateSessionId,
    generateLineItemId,
    generatePaymentIntentId,
} from '../utils/id';
import { paginate, ListQueryParams } from '../utils/pagination';

type StripeCheckoutSession = Stripe.Checkout.Session;
type StripeLineItem = Stripe.LineItem;
type StripePrice = Stripe.Price;
type CreateCheckoutSessionParams = Stripe.Checkout.SessionCreateParams;
type CheckoutLineItemParam = Stripe.Checkout.SessionCreateParams.LineItem;

const router = Router();

// ── Create checkout session ───────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
    const params = req.body as CreateCheckoutSessionParams;

    if (!params.mode) {
        res.status(400).json({
            error: {
                type: 'invalid_request_error',
                message: 'Missing required param: mode',
                param: 'mode',
            },
        });
        return;
    }
    if (!params.success_url) {
        res.status(400).json({
            error: {
                type: 'invalid_request_error',
                message: 'Missing required param: success_url',
                param: 'success_url',
            },
        });
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    const sessionId = generateSessionId();
    const baseUrl =
        process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 4242}`;

    // Build line items and compute totals
    const lineItems: StripeLineItem[] = [];
    let amountSubtotal = 0;
    let currency = 'usd';

    for (const item of params.line_items ?? []) {
        const { resolvedPrice, resolvedDescription, resolvedCurrency } =
            resolveLineItem(item, now);
        const qty = item.quantity ?? 1;
        const unitAmount = resolvedPrice.unit_amount ?? 0;
        const subtotal = unitAmount * qty;

        amountSubtotal += subtotal;
        currency = resolvedCurrency;

        lineItems.push({
            id: generateLineItemId(),
            object: 'item',
            adjustable_quantity: null,
            amount_discount: 0,
            amount_subtotal: subtotal,
            amount_tax: 0,
            amount_total: subtotal,
            currency: resolvedCurrency,
            description: resolvedDescription,
            metadata: null,
            price: resolvedPrice,
            quantity: qty,
        } satisfies StripeLineItem);
    }

    const session = {
        id: sessionId,
        object: 'checkout.session',
        after_expiration: null,
        allow_promotion_codes: params.allow_promotion_codes ?? null,
        amount_subtotal: amountSubtotal,
        amount_total: amountSubtotal,
        automatic_tax: {
            enabled: false,
            liability: null,
            provider: null,
            status: null,
        },
        billing_address_collection: params.billing_address_collection ?? null,
        cancel_url: params.cancel_url ?? null,
        client_reference_id: params.client_reference_id ?? null,
        consent: null,
        consent_collection: null,
        created: now,
        currency,
        customer: params.customer ?? null,
        customer_creation: null,
        customer_details: null,
        customer_email: params.customer_email ?? null,
        expires_at: params.expires_at ?? now + 1800,
        livemode: false,
        locale: params.locale ?? null,
        metadata: (params.metadata ?? {}) as Stripe.Metadata,
        mode: params.mode,
        payment_intent:
            params.mode === 'payment' ? generatePaymentIntentId() : null,
        payment_link: null,
        payment_method_collection: null,
        payment_method_types: params.payment_method_types ?? ['card'],
        payment_status: 'unpaid',
        phone_number_collection: { enabled: false },
        recovered_from: null,
        setup_intent: null,
        shipping_address_collection: null,
        shipping_cost: null,
        shipping_options: [],
        status: 'open',
        submit_type: null,
        subscription: null,
        success_url: params.success_url,
        total_details: {
            amount_discount: 0,
            amount_shipping: 0,
            amount_tax: 0,
        },
        url: `${baseUrl}/checkout/mock-payment?session_id=${sessionId}`,
    } as unknown as StripeCheckoutSession;

    dataStore.setSession(session);
    dataStore.setSessionLineItems(sessionId, lineItems);

    res.json(session);
});

// ── List sessions ─────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
    const sessions = dataStore.getSessions();
    res.json(
        paginate(
            sessions,
            req.query as ListQueryParams,
            '/v1/checkout/sessions',
        ),
    );
});

// ── Retrieve session ──────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
    const session = dataStore.getSession(req.params.id);
    if (!session) {
        res.status(404).json(sessionNotFound(req.params.id));
        return;
    }
    res.json(session);
});

// ── List session line items ───────────────────────────────────────────────────
router.get('/:id/line_items', (req: Request, res: Response) => {
    const session = dataStore.getSession(req.params.id);
    if (!session) {
        res.status(404).json(sessionNotFound(req.params.id));
        return;
    }
    const items = dataStore.getSessionLineItems(req.params.id);
    res.json(
        paginate(
            items,
            req.query as ListQueryParams,
            `/v1/checkout/sessions/${req.params.id}/line_items`,
        ),
    );
});

// ── Expire session ────────────────────────────────────────────────────────────
router.post('/:id/expire', (req: Request, res: Response) => {
    const session = dataStore.getSession(req.params.id);
    if (!session) {
        res.status(404).json(sessionNotFound(req.params.id));
        return;
    }
    const expired: StripeCheckoutSession = { ...session, status: 'expired' };
    dataStore.setSession(expired);
    res.json(expired);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sessionNotFound(id: string) {
    return {
        error: {
            type: 'invalid_request_error',
            code: 'resource_missing',
            message: `No such checkout.session: '${id}'`,
            param: 'id',
        },
    };
}

interface ResolvedLineItem {
    resolvedPrice: StripePrice;
    resolvedDescription: string;
    resolvedCurrency: string;
}

function resolveLineItem(
    item: CheckoutLineItemParam,
    now: number,
): ResolvedLineItem {
    // Case 1: price ID reference
    if (item.price) {
        const price = dataStore.getPrice(item.price);
        if (price) {
            const productId =
                typeof price.product === 'string' ? price.product : undefined;
            const product = productId
                ? dataStore.getProduct(productId)
                : undefined;
            return {
                resolvedPrice: price,
                resolvedDescription:
                    product?.name ?? price.nickname ?? price.id,
                resolvedCurrency: price.currency,
            };
        }
    }

    // Case 2: inline price_data
    if (item.price_data) {
        const pd = item.price_data;
        const product = pd.product
            ? dataStore.getProduct(pd.product)
            : undefined;
        const inlinePrice: StripePrice = {
            id: `price_inline_${now}`,
            object: 'price',
            active: true,
            billing_scheme: 'per_unit',
            created: now,
            currency: pd.currency.toLowerCase(),
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: null,
            product: pd.product ?? '',
            recurring: pd.recurring
                ? {
                      interval: pd.recurring
                          .interval as Stripe.Price.Recurring['interval'],
                      interval_count: pd.recurring.interval_count ?? 1,
                      meter: null,
                      trial_period_days: null,
                      usage_type: 'licensed',
                  }
                : null,
            tax_behavior: 'unspecified',
            tiers_mode: null,
            transform_quantity: null,
            type: pd.recurring ? 'recurring' : 'one_time',
            unit_amount: pd.unit_amount ?? null,
            unit_amount_decimal:
                pd.unit_amount != null ? String(pd.unit_amount) : null,
        };
        return {
            resolvedPrice: inlinePrice,
            resolvedDescription: product?.name ?? pd.product ?? '',
            resolvedCurrency: pd.currency.toLowerCase(),
        };
    }

    // Fallback: empty price stub
    const stub: StripePrice = {
        id: '',
        object: 'price',
        active: true,
        billing_scheme: 'per_unit',
        created: now,
        currency: 'usd',
        custom_unit_amount: null,
        livemode: false,
        lookup_key: null,
        metadata: {},
        nickname: null,
        product: '',
        recurring: null,
        tax_behavior: 'unspecified',
        tiers_mode: null,
        transform_quantity: null,
        type: 'one_time',
        unit_amount: 0,
        unit_amount_decimal: '0',
    };
    return {
        resolvedPrice: stub,
        resolvedDescription: '',
        resolvedCurrency: 'usd',
    };
}

export default router;
