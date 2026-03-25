import type Stripe from 'stripe';
import { dataStore } from '../store/dataStore';

/**
 * Parse the `expand[]` query/body parameter into a flat string array.
 *
 * The Stripe Node.js SDK serialises arrays with indexed brackets:
 *   expand[0]=data.product  →  qs may yield { expand: ['data.product'] }
 *                               OR  { expand: { '0': 'data.product' } }
 * We also accept the plain-bracket form  expand[]=data.product  and a
 * bare string  expand=data.product.
 *
 * Pass the merged source of both `req.query` and `req.body` so it works
 * whether the SDK puts params in the URL or in a form-encoded body.
 */
export function parseExpand(source: Record<string, unknown>): string[] {
    // Some serialisers keep the brackets in the key name literally.
    const raw = source['expand'] ?? source['expand[]'];
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return (raw as unknown[]).filter(
            (v): v is string => typeof v === 'string',
        );
    }
    // qs may parse expand[0]=val as { '0': 'val' } (object, not array)
    if (typeof raw === 'object' && raw !== null) {
        return Object.values(raw as Record<string, unknown>).filter(
            (v): v is string => typeof v === 'string',
        );
    }
    if (typeof raw === 'string') return [raw];
    return [];
}

/**
 * Expand `default_price` on a product when the caller requests it.
 * Accepts both the single-object form (`default_price`) and the list
 * data-item form (`data.default_price`).
 */
export function expandProduct(
    product: Stripe.Product,
    expand: string[],
): Stripe.Product {
    const wants = expand.some(
        (e) => e === 'default_price' || e === 'data.default_price',
    );
    if (!wants) return product;
    if (!product.default_price || typeof product.default_price !== 'string') {
        return product;
    }
    const price = dataStore.getPrice(product.default_price);
    if (!price) return product;
    return { ...product, default_price: price };
}

/**
 * Expand `product` on a price when the caller requests it.
 * Accepts both the single-object form (`product`) and the list
 * data-item form (`data.product`).
 */
export function expandPrice(
    price: Stripe.Price,
    expand: string[],
): Stripe.Price {
    const wants = expand.some((e) => e === 'product' || e === 'data.product');
    if (!wants) return price;
    if (!price.product || typeof price.product !== 'string') return price;
    const product = dataStore.getProduct(price.product);
    if (!product) return price;
    return { ...price, product };
}
