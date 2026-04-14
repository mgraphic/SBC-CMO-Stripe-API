import { Router, Request, Response } from 'express';
import type Stripe from 'stripe';
import { dataStore } from '../store/dataStore';
import { generateProductId } from '../utils/id';
import { paginate, ListQueryParams } from '../utils/pagination';
import { parseExpand, expandProduct } from '../utils/expand';

type StripeProduct = Stripe.Product;

const router = Router();

// ── List products ─────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
    let products = dataStore.getProducts();

    if (req.query.active !== undefined) {
        const active = req.query.active === 'true';
        products = products.filter((p) => p.active === active);
    }

    // Support ?ids[]=prod_xxx&ids[]=prod_yyy
    const ids = req.query['ids[]'] ?? req.query.ids;
    if (ids) {
        const idList = Array.isArray(ids) ? (ids as string[]) : [ids as string];
        products = products.filter((p) => idList.includes(p.id));
    }

    const expand = parseExpand({
        ...(req.query as Record<string, unknown>),
        ...req.body,
    });
    const expanded = products.map((p) => expandProduct(p, expand));
    res.json(paginate(expanded, req.query as ListQueryParams, '/v1/products'));
});

// ── Search products ───────────────────────────────────────────────────────────
// Supports a subset of Stripe's search query syntax:
//   field:'value' AND field:'value'
//   Supported fields: active, name, metadata['key']
router.get('/search', (req: Request, res: Response) => {
    const query = (req.query.query as string) ?? '';
    const limit = Math.min(
        parseInt((req.query.limit as string) ?? '10', 10),
        100,
    );

    let products = dataStore.getProducts();

    // Parse each AND-separated clause
    const clauses = query
        .split(/\s+AND\s+/i)
        .map((s) => s.trim())
        .filter(Boolean);
    for (const clause of clauses) {
        // metadata['key']:'value'
        const metaMatch = clause.match(
            /^metadata\[['"](.+?)['"]\]\s*:\s*['"](.+?)['"]$/,
        );
        if (metaMatch) {
            const [, metaKey, metaVal] = metaMatch;
            products = products.filter(
                (p) =>
                    p.metadata &&
                    (p.metadata as Record<string, string>)[metaKey] === metaVal,
            );
            continue;
        }

        // field:'value'
        const fieldMatch = clause.match(/^(\w+)\s*:\s*['"](.+?)['"]$/);
        if (fieldMatch) {
            const [, field, value] = fieldMatch;
            if (field === 'active') {
                const active = value === 'true';
                products = products.filter((p) => p.active === active);
            } else if (field === 'name') {
                products = products.filter((p) => p.name === value);
            }
        }
    }

    const expand = parseExpand({
        ...(req.query as Record<string, unknown>),
        ...req.body,
    });

    const paged = products.slice(0, limit);
    const hasMore = products.length > limit;
    const expanded = paged.map((p) => expandProduct(p, expand));

    res.json({
        object: 'search_result',
        url: '/v1/products/search',
        has_more: hasMore,
        data: expanded,
        next_page: null,
        total_count: products.length,
    });
});

// ── Retrieve product ──────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
    const product = dataStore.getProduct(req.params.id);
    if (!product) {
        res.status(404).json({
            error: {
                type: 'invalid_request_error',
                code: 'resource_missing',
                message: `No such product: '${req.params.id}'`,
                param: 'id',
            },
        });
        return;
    }
    const expand = parseExpand({
        ...(req.query as Record<string, unknown>),
        ...req.body,
    });
    res.json(expandProduct(product, expand));
});

// ── Create product ────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
    if (!req.body.name) {
        res.status(400).json({
            error: {
                type: 'invalid_request_error',
                message: 'Missing required param: name.',
                param: 'name',
            },
        });
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    const product = {
        id: generateProductId(),
        object: 'product' as const,
        active: req.body.active ?? true,
        created: now,
        default_price: req.body.default_price ?? null,
        description: req.body.description ?? null,
        images: req.body.images ?? [],
        livemode: false,
        marketing_features: [],
        metadata: req.body.metadata ?? {},
        name: req.body.name as string,
        package_dimensions: null,
        shippable: req.body.shippable ?? null,
        statement_descriptor: req.body.statement_descriptor ?? null,
        tax_code: req.body.tax_code ?? null,
        type: 'service' as const,
        unit_label: req.body.unit_label ?? null,
        updated: now,
        url: req.body.url ?? null,
    } satisfies StripeProduct;
    dataStore.setProduct(product);
    res.json(product);
});

// ── Update product ────────────────────────────────────────────────────────────
router.post('/:id', (req: Request, res: Response) => {
    const product = dataStore.getProduct(req.params.id);
    if (!product) {
        res.status(404).json({
            error: {
                type: 'invalid_request_error',
                code: 'resource_missing',
                message: `No such product: '${req.params.id}'`,
                param: 'id',
            },
        });
        return;
    }

    const updatable: Array<keyof StripeProduct> = [
        'active',
        'default_price',
        'description',
        'images',
        'metadata',
        'name',
        'shippable',
        'statement_descriptor',
        'tax_code',
        'unit_label',
        'url',
    ];

    const updated: StripeProduct = {
        ...product,
        updated: Math.floor(Date.now() / 1000),
    };
    for (const key of updatable) {
        if (req.body[key] !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (updated as any)[key] = req.body[key];
        }
    }

    dataStore.setProduct(updated);
    res.json(updated);
});

// ── Delete product ────────────────────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
    const product = dataStore.getProduct(req.params.id);
    if (!product) {
        res.status(404).json({
            error: {
                type: 'invalid_request_error',
                code: 'resource_missing',
                message: `No such product: '${req.params.id}'`,
                param: 'id',
            },
        });
        return;
    }
    dataStore.deleteProduct(req.params.id);
    res.json({ id: req.params.id, object: 'product', deleted: true });
});

export default router;
