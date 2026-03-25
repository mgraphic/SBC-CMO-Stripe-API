import fs from 'fs';
import path from 'path';
import type Stripe from 'stripe';

type StripeProduct = Stripe.Product;
type StripePrice = Stripe.Price;
type StripeCheckoutSession = Stripe.Checkout.Session;
type StripeLineItem = Stripe.LineItem;

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');

/**
 * Accepts both a plain array and Stripe's list response envelope:
 *   { object: "list", data: [...] }
 */
function parseStripeExport<T>(raw: unknown): T[] {
    if (Array.isArray(raw)) return raw as T[];
    if (
        raw &&
        typeof raw === 'object' &&
        'data' in raw &&
        Array.isArray((raw as Record<string, unknown>).data)
    ) {
        return (raw as { data: T[] }).data;
    }
    return [];
}

function loadJsonFile<T>(filename: string): T[] {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return parseStripeExport<T>(raw);
    } catch (err) {
        console.warn(
            `[DataStore] Warning: could not parse ${filename}:`,
            (err as Error).message,
        );
        return [];
    }
}

class DataStore {
    private products: Map<string, StripeProduct> = new Map();
    private prices: Map<string, StripePrice> = new Map();
    private sessions: Map<string, StripeCheckoutSession> = new Map();
    private sessionLineItems: Map<string, StripeLineItem[]> = new Map();

    constructor() {
        this.loadFromFiles();
    }

    // ── File loading ─────────────────────────────────────────────────────────

    loadFromFiles(): void {
        const products = loadJsonFile<StripeProduct>('products.json');
        const prices = loadJsonFile<StripePrice>('prices.json');

        this.products = new Map(products.map((p) => [p.id, p]));
        this.prices = new Map(prices.map((p) => [p.id, p]));

        console.log(
            `[DataStore] Loaded ${this.products.size} products and ${this.prices.size} prices from ${DATA_DIR}`,
        );
    }

    // ── Products ──────────────────────────────────────────────────────────────

    getProducts(): StripeProduct[] {
        return Array.from(this.products.values());
    }

    getProduct(id: string): StripeProduct | undefined {
        return this.products.get(id);
    }

    setProduct(product: StripeProduct): void {
        this.products.set(product.id, product);
    }

    deleteProduct(id: string): boolean {
        return this.products.delete(id);
    }

    importProducts(items: StripeProduct[]): number {
        items.forEach((p) => this.products.set(p.id, p));
        return items.length;
    }

    // ── Prices ────────────────────────────────────────────────────────────────

    getPrices(): StripePrice[] {
        return Array.from(this.prices.values());
    }

    getPrice(id: string): StripePrice | undefined {
        return this.prices.get(id);
    }

    setPrice(price: StripePrice): void {
        this.prices.set(price.id, price);
    }

    importPrices(items: StripePrice[]): number {
        items.forEach((p) => this.prices.set(p.id, p));
        return items.length;
    }

    // ── Checkout Sessions ─────────────────────────────────────────────────────

    getSessions(): StripeCheckoutSession[] {
        return Array.from(this.sessions.values());
    }

    getSession(id: string): StripeCheckoutSession | undefined {
        return this.sessions.get(id);
    }

    setSession(session: StripeCheckoutSession): void {
        this.sessions.set(session.id, session);
    }

    // ── Session Line Items ────────────────────────────────────────────────────

    getSessionLineItems(sessionId: string): StripeLineItem[] {
        return this.sessionLineItems.get(sessionId) ?? [];
    }

    setSessionLineItems(sessionId: string, items: StripeLineItem[]): void {
        this.sessionLineItems.set(sessionId, items);
    }
}

export const dataStore = new DataStore();
