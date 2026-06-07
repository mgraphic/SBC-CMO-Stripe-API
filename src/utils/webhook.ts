import type Stripe from 'stripe';
import { Stripe as StripeClient } from 'stripe';
import {
    generateEventId,
    generateChargeId,
    generatePaymentMethodId,
    generateBalanceTransactionId,
} from './id';

type StripeCheckoutSession = Stripe.Checkout.Session;

const API_VERSION = '2026-02-25.clover';

function makeEvent(
    type: string,
    data: Record<string, unknown>,
    pendingWebhooks = 1,
) {
    return {
        id: generateEventId(),
        object: 'event',
        api_version: API_VERSION,
        created: Math.floor(Date.now() / 1000),
        data: { object: data },
        livemode: false,
        pending_webhooks: pendingWebhooks,
        request: { id: null, idempotency_key: null },
        type,
    };
}

async function postEvent(
    url: string,
    event: ReturnType<typeof makeEvent>,
): Promise<void> {
    const body = JSON.stringify({ timestamp: new Date().toISOString(), event });
    const secret = process.env.WEBHOOK_SECRET ?? 'mock_signature';
    const signature = StripeClient.webhooks.generateTestHeaderString({
        payload: body,
        secret,
    });

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'stripe-signature': signature,
            },
            body,
        });
        if (!res.ok) {
            console.warn(`[webhook] ${event.type} → HTTP ${res.status}`);
        } else {
            console.log(`[webhook] ${event.type} → ${res.status}`);
        }
    } catch (err) {
        console.warn(
            `[webhook] Failed to deliver ${event.type}:`,
            (err as Error).message,
        );
    }
}

/**
 * Fire the standard sequence of Stripe webhook events that follow a successful
 * checkout session payment. Only runs when WEBHOOK_URL is configured.
 */
export async function dispatchCheckoutWebhooks(
    session: StripeCheckoutSession,
): Promise<void> {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) return;

    const now = Math.floor(Date.now() / 1000);
    const paymentIntentId = (session.payment_intent as string | null) ?? null;
    const chargeId = generateChargeId();
    const paymentMethodId = generatePaymentMethodId();
    const balanceTransactionId = generateBalanceTransactionId();
    const amount = session.amount_total ?? 0;
    const currency = session.currency ?? 'usd';

    // ── payment_intent.created ────────────────────────────────────────────────
    if (paymentIntentId) {
        await postEvent(
            webhookUrl,
            makeEvent(
                'payment_intent.created',
                {
                    id: paymentIntentId,
                    object: 'payment_intent',
                    amount,
                    amount_capturable: 0,
                    amount_details: { tip: {} },
                    amount_received: 0,
                    application: null,
                    application_fee_amount: null,
                    automatic_payment_methods: null,
                    canceled_at: null,
                    cancellation_reason: null,
                    capture_method: 'automatic_async',
                    client_secret: `${paymentIntentId}_secret_mock`,
                    confirmation_method: 'automatic',
                    created: session.created,
                    currency,
                    customer: session.customer ?? null,
                    description: null,
                    last_payment_error: null,
                    latest_charge: null,
                    livemode: false,
                    metadata: {},
                    next_action: null,
                    on_behalf_of: null,
                    payment_method: null,
                    payment_method_types: session.payment_method_types ?? [
                        'card',
                    ],
                    receipt_email: null,
                    setup_future_usage: null,
                    shipping: null,
                    status: 'requires_payment_method',
                    transfer_data: null,
                    transfer_group: null,
                },
                2,
            ),
        );
    }

    // ── payment_intent.succeeded ──────────────────────────────────────────────
    if (paymentIntentId) {
        await postEvent(
            webhookUrl,
            makeEvent(
                'payment_intent.succeeded',
                {
                    id: paymentIntentId,
                    object: 'payment_intent',
                    amount,
                    amount_capturable: 0,
                    amount_details: { tip: {} },
                    amount_received: amount,
                    application: null,
                    application_fee_amount: null,
                    automatic_payment_methods: null,
                    canceled_at: null,
                    cancellation_reason: null,
                    capture_method: 'automatic_async',
                    client_secret: `${paymentIntentId}_secret_mock`,
                    confirmation_method: 'automatic',
                    created: session.created,
                    currency,
                    customer: session.customer ?? null,
                    description: null,
                    last_payment_error: null,
                    latest_charge: chargeId,
                    livemode: false,
                    metadata: {},
                    next_action: null,
                    on_behalf_of: null,
                    payment_method: paymentMethodId,
                    payment_method_types: session.payment_method_types ?? [
                        'card',
                    ],
                    receipt_email: null,
                    setup_future_usage: null,
                    shipping: null,
                    status: 'succeeded',
                    transfer_data: null,
                    transfer_group: null,
                },
                2,
            ),
        );
    }

    // ── charge.succeeded ──────────────────────────────────────────────────────
    const chargeObject = {
        id: chargeId,
        object: 'charge',
        amount,
        amount_captured: amount,
        amount_refunded: 0,
        application: null,
        application_fee: null,
        application_fee_amount: null,
        balance_transaction: null,
        billing_details: {
            address: {
                city: null,
                country: null,
                line1: null,
                line2: null,
                postal_code: null,
                state: null,
            },
            email: session.customer_email ?? null,
            name: null,
            phone: null,
        },
        captured: true,
        created: now,
        currency,
        customer: session.customer ?? null,
        description: null,
        dispute: null,
        disputed: false,
        failure_code: null,
        failure_message: null,
        fraud_details: {},
        livemode: false,
        metadata: {},
        on_behalf_of: null,
        outcome: {
            network_status: 'approved_by_network',
            reason: null,
            risk_level: 'normal',
            risk_score: 38,
            seller_message: 'Payment complete.',
            type: 'authorized',
        },
        paid: true,
        payment_intent: paymentIntentId,
        payment_method: paymentMethodId,
        payment_method_details: {
            card: {
                brand: 'visa',
                last4: '4242',
                exp_month: 12,
                exp_year: 2026,
                funding: 'credit',
                country: 'US',
                checks: {
                    cvc_check: 'pass',
                    address_line1_check: null,
                    address_postal_code_check: null,
                },
            },
            type: 'card',
        },
        radar_options: {},
        receipt_email: null,
        receipt_number: null,
        receipt_url: null,
        refunded: false,
        review: null,
        shipping: null,
        source: null,
        source_transfer: null,
        statement_descriptor: null,
        statement_descriptor_suffix: null,
        status: 'succeeded',
        transfer_data: null,
        transfer_group: null,
    };

    await postEvent(webhookUrl, makeEvent('charge.succeeded', chargeObject, 2));

    // ── checkout.session.completed ────────────────────────────────────────────
    const completedSession = {
        ...session,
        status: 'complete',
        payment_status: 'paid',
        customer_details: {
            address: {
                city: null,
                country: null,
                line1: null,
                line2: null,
                postal_code: null,
                state: null,
            },
            email: session.customer_email ?? null,
            name: null,
            phone: null,
            tax_exempt: 'none',
            tax_ids: [],
        },
    };

    await postEvent(
        webhookUrl,
        makeEvent(
            'checkout.session.completed',
            completedSession as unknown as Record<string, unknown>,
            1,
        ),
    );

    // ── charge.updated (balance_transaction populated) ────────────────────────
    await postEvent(
        webhookUrl,
        makeEvent(
            'charge.updated',
            {
                ...chargeObject,
                balance_transaction: balanceTransactionId,
            },
            2,
        ),
    );
}
