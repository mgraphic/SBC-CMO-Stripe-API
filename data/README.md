# Data Directory

Place your Stripe JSON exports here before starting the server. The API loads them automatically on startup.

## Expected Files

| File            | Contents             |
| --------------- | -------------------- |
| `products.json` | Your Stripe products |
| `prices.json`   | Your Stripe prices   |

## Supported Formats

Both the raw Stripe API list response and a plain JSON array are accepted.

**Stripe list response** (export via `stripe products list --limit=100`):

```json
{
  "object": "list",
  "data": [ ... ],
  "has_more": false,
  "url": "/v1/products"
}
```

**Plain array**:

```json
[ { "id": "prod_xxx", "name": "My Product", ... } ]
```

## Exporting from Stripe CLI

```bash
# Install Stripe CLI if you haven't already
# https://stripe.com/docs/stripe-cli

stripe products list --limit=100 > products.json
stripe prices list --limit=100 > prices.json
```

## Reloading at Runtime

Without restarting the server, call:

```
POST /v1/import/reload
Authorization: Bearer sk_test_mock
```
