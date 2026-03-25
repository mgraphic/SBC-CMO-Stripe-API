import { Router, Request, Response } from 'express';
import type Stripe from 'stripe';
import { dataStore } from '../store/dataStore';
import { generatePriceId } from '../utils/id';
import { paginate, ListQueryParams } from '../utils/pagination';
import { parseExpand, expandPrice } from '../utils/expand';

type StripePrice = Stripe.Price;
type StripeRecurring = Stripe.Price.Recurring;

const router = Router();

// ── List prices ───────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
    let prices = dataStore.getPrices();

    if (req.query.active !== undefined) {
        const active = req.query.active === 'true';
        prices = prices.filter((p) => p.active === active);
    }
    if (req.query.product) {
        prices = prices.filter(
            (p) => p.product === (req.query.product as string),
        );
    }
    if (req.query.type) {
        prices = prices.filter((p) => p.type === (req.query.type as string));
    }
    if (req.query.currency) {
        prices = prices.filter(
            (p) => p.currency === (req.query.currency as string),
        );
    }

    const expand = parseExpand({
        ...(req.query as Record<string, unknown>),
        ...req.body,
    });
    const expanded = prices.map((p) => expandPrice(p, expand));
    res.json(paginate(expanded, req.query as ListQueryParams, '/v1/prices'));
});

// ── Retrieve price ────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
    const price = dataStore.getPrice(req.params.id);
    if (!price) {
        res.status(404).json({
            error: {
                type: 'invalid_request_error',
                code: 'resource_missing',
                message: `No such price: '${req.params.id}'`,
                param: 'id',
            },
        });
        return;
    }
    const expand = parseExpand({
        ...(req.query as Record<string, unknown>),
        ...req.body,
    });
    res.json(expandPrice(price, expand));
});

// ── Create price ──────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
    const {
        currency,
        product,
        unit_amount,
        recurring,
        type,
        nickname,
        active,
        metadata,
        billing_scheme,
        tax_behavior,
        lookup_key,
    } = req.body;

    if (!currency) {
        res.status(400).json({
            error: {
                type: 'invalid_request_error',
                message: 'Missing required param: currency',
                param: 'currency',
            },
        });
        return;
    }
    if (!product) {
        res.status(400).json({
            error: {
                type: 'invalid_request_error',
                message: 'Missing required param: product',
                param: 'product',
            },
        });
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    const priceType: 'one_time' | 'recurring' =
        type ?? (recurring ? 'recurring' : 'one_time');

    let parsedRecurring: StripeRecurring | null = null;
    if (recurring) {
        parsedRecurring = {
            interval: recurring.interval,
            interval_count: Number(recurring.interval_count ?? 1),
            meter: null,
            trial_period_days: recurring.trial_period_days ?? null,
            usage_type: recurring.usage_type ?? 'licensed',
        };
    }

    const unitAmountNum = unit_amount != null ? Number(unit_amount) : null;

    const price: StripePrice = {
        id: generatePriceId(),
        object: 'price',
        active: active ?? true,
        billing_scheme: billing_scheme ?? 'per_unit',
        created: now,
        currency: (currency as string).toLowerCase(),
        custom_unit_amount: null,
        livemode: false,
        lookup_key: lookup_key ?? null,
        metadata: metadata ?? {},
        nickname: nickname ?? null,
        product: product as string,
        recurring: parsedRecurring,
        tax_behavior: tax_behavior ?? 'unspecified',
        tiers_mode: null,
        transform_quantity: null,
        type: priceType,
        unit_amount: unitAmountNum,
        unit_amount_decimal:
            unitAmountNum != null ? String(unitAmountNum) : null,
    };

    dataStore.setPrice(price);
    res.json(price);
});

// ── Update price ──────────────────────────────────────────────────────────────
router.post('/:id', (req: Request, res: Response) => {
    const price = dataStore.getPrice(req.params.id);
    if (!price) {
        res.status(404).json({
            error: {
                type: 'invalid_request_error',
                code: 'resource_missing',
                message: `No such price: '${req.params.id}'`,
                param: 'id',
            },
        });
        return;
    }

    const updatable: Array<keyof StripePrice> = [
        'active',
        'metadata',
        'nickname',
        'lookup_key',
        'tax_behavior',
    ];
    const updated: StripePrice = { ...price };
    for (const key of updatable) {
        if (req.body[key] !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updated as any)[key] = req.body[key];
        }
    }

    dataStore.setPrice(updated);
    res.json(updated);
});

export default router;
