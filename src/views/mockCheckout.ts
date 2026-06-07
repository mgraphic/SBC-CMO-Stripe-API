import type Stripe from 'stripe';

type StripeCheckoutSession = Stripe.Checkout.Session;
type StripeLineItem = Stripe.LineItem;

function formatAmount(
    amount: number | null | undefined,
    currency: string,
): string {
    if (amount == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
    }).format(amount / 100);
}

export function renderNotFound(sessionId: string | undefined): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Session Not Found</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f9fc; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; }
        h2 { color: #e53e3e; margin-bottom: 12px; }
        p { color: #6b7280; }
    </style>
</head>
<body>
    <div class="card">
        <h2>Session Not Found</h2>
        <p>No checkout session found for ID: <code>${sessionId ?? 'n/a'}</code></p>
    </div>
</body>
</html>`;
}

export function renderMockCheckout(
    session: StripeCheckoutSession,
    lineItems: StripeLineItem[],
): string {
    const currency = session.currency ?? 'usd';
    const createdDate = new Date(session.created * 1000).toLocaleString();
    const successUrl = session.success_url ?? '#';
    const cancelUrl =
        (session as { cancel_url?: string | null }).cancel_url ?? '#';

    const itemRows = lineItems
        .map(
            (item) => `
        <tr>
            <td>${item.description ?? 'Item'}</td>
            <td style="text-align:center">${item.quantity ?? 1}</td>
            <td style="text-align:right">${formatAmount(item.price?.unit_amount, item.currency)}</td>
            <td style="text-align:right">${formatAmount(item.amount_total, item.currency)}</td>
        </tr>`,
        )
        .join('');

    const itemsSection =
        lineItems.length > 0
            ? `
        <div class="section-label">Items</div>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>${itemRows}
            </tbody>
        </table>
        <div class="totals">
            <span>Subtotal: ${formatAmount(session.amount_subtotal, currency)}</span>
            <span class="total-row">Total: ${formatAmount(session.amount_total, currency)}</span>
        </div>`
            : '';

    const emailRow = session.customer_email
        ? `
                    <div class="detail-item">
                        <div class="label">Email</div>
                        <div class="value">${session.customer_email}</div>
                    </div>`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock Checkout</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f9fc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
        .card { background: #fff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px 36px; max-width: 560px; width: 100%; }
        .badge { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; padding: 3px 10px; border-radius: 99px; margin-bottom: 20px; }
        h2 { font-size: 22px; color: #111827; margin-bottom: 4px; }
        .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 28px; }
        .section-label { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #9ca3af; margin-bottom: 10px; margin-top: 24px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .detail-item { font-size: 13px; }
        .detail-item .label { color: #9ca3af; margin-bottom: 2px; }
        .detail-item .value { color: #111827; font-weight: 500; word-break: break-all; }
        table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 14px; }
        thead th { color: #9ca3af; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0; border-bottom: 1px solid #e5e7eb; text-align: left; }
        thead th:nth-child(2) { text-align: center; }
        thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
        tbody td { padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: top; }
        .totals { margin-top: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; font-size: 14px; color: #6b7280; }
        .totals .total-row { font-size: 16px; font-weight: 700; color: #111827; margin-top: 4px; }
        .divider { border: none; border-top: 1px solid #e5e7eb; margin: 28px 0; }
        .mock-notice { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #1e40af; margin-bottom: 28px; }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .btn { display: block; padding: 14px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; text-decoration: none; cursor: pointer; border: none; transition: opacity 0.15s; }
        .btn:hover { opacity: 0.88; }
        .btn-success { background: #16a34a; color: #fff; }
        .btn-cancel { background: #fff; color: #374151; border: 1.5px solid #d1d5db; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">Mock Payment</span>
        <h2>Order Review</h2>
        <p class="subtitle">Review your order and simulate a payment outcome below.</p>

        <div class="section-label">Order Details</div>
        <div class="details-grid">
            <div class="detail-item">
                <div class="label">Session ID</div>
                <div class="value"><code style="font-size:12px">${session.id}</code></div>
            </div>
            <div class="detail-item">
                <div class="label">Mode</div>
                <div class="value">${session.mode ?? 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="label">Status</div>
                <div class="value">${session.status ?? 'N/A'}</div>
            </div>
            <div class="detail-item">
                <div class="label">Payment Status</div>
                <div class="value">${session.payment_status ?? 'N/A'}</div>
            </div>${emailRow}
            <div class="detail-item">
                <div class="label">Created</div>
                <div class="value">${createdDate}</div>
            </div>
        </div>
        ${itemsSection}
        <hr class="divider">

        <div class="mock-notice">
            This is a mock payment page. No real payment is processed. Choose an outcome below to simulate a redirect.
        </div>

        <div class="actions">
            <form method="POST" action="/checkout/mock-payment" style="display:contents">
                <input type="hidden" name="session_id" value="${session.id}">
                <button type="submit" class="btn btn-success">Complete Payment</button>
            </form>
            <a href="${cancelUrl}" class="btn btn-cancel">Cancel Order</a>
        </div>
    </div>
</body>
</html>`;
}
