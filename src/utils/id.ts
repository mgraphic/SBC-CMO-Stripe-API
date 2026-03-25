import { randomBytes } from 'crypto';

function makeId(prefix: string, length = 24): string {
    return `${prefix}${randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length)}`;
}

export const generateProductId = (): string => makeId('prod_');
export const generatePriceId = (): string => makeId('price_');
export const generateSessionId = (): string => makeId('cs_test_', 58);
export const generateLineItemId = (): string => makeId('li_');
export const generatePaymentIntentId = (): string => makeId('pi_');
