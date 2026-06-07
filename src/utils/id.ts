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
export const generateEventId = (): string => makeId('evt_');
export const generateChargeId = (): string => makeId('ch_');
export const generatePaymentMethodId = (): string => makeId('pm_');
export const generateBalanceTransactionId = (): string => makeId('txn_');
