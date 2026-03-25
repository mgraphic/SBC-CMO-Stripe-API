# SBC CMO Stripe Mock API

A local mock Stripe API server that emulates the Products, Prices, and Checkout Sessions endpoints. Drop in your Stripe account's exported JSON data and point your app at `http://localhost:4242`.

## Features

- **Products API** — Full CRUD, filtering, and Stripe-style cursor pagination
- **Prices API** — Full CRUD with product/type/currency filtering
- **Checkout Sessions API** — Create, retrieve, list, expire, and line-item queries
- **Data import** — Load exported JSON from your real Stripe account on startup or at runtime
- **Docker Compose** — Single command to run, volume-mounted data directory
- **Stripe-compatible responses** — Matches the Stripe API response envelope (`object`, `data`, `has_more`, `url`)

---

## Quick Start

### Local development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Drop your Stripe exports into data/
#    data/products.json
#    data/prices.json

# 4. Start dev server (auto-reloads on changes)
npm run dev
```

### Docker Compose

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

The API will be available at `http://localhost:4242`.

---

## Data Import

On startup the server reads `data/products.json` and `data/prices.json` from the `DATA_DIR` (default: `./data`).

Both file formats are accepted:

```json
// Stripe API response envelope
{ "object": "list", "data": [ ... ], "has_more": false, "url": "/v1/products" }

// Plain array
[ { "id": "prod_xxx", ... } ]
```

### Export from the Stripe CLI

```bash
stripe products list --limit=100 > data/products.json
stripe prices list   --limit=100 > data/prices.json
```

### Runtime import (no restart needed)

```bash
# Reload files from disk
curl -X POST http://localhost:4242/v1/import/reload \
  -H "Authorization: Bearer sk_test_mock"

# POST a products JSON body directly
curl -X POST http://localhost:4242/v1/import/products \
  -H "Authorization: Bearer sk_test_mock" \
  -H "Content-Type: application/json" \
  -d @data/products.json
```

---

## API Reference

All `/v1/*` endpoints require `Authorization: Bearer <key>`.  
Configure valid keys via the `STRIPE_API_KEYS` environment variable.

### Health

| Method | Path      | Description                       |
| ------ | --------- | --------------------------------- |
| `GET`  | `/health` | Liveness check — no auth required |

### Products

| Method   | Path               | Description        |
| -------- | ------------------ | ------------------ |
| `GET`    | `/v1/products`     | List products      |
| `GET`    | `/v1/products/:id` | Retrieve a product |
| `POST`   | `/v1/products`     | Create a product   |
| `POST`   | `/v1/products/:id` | Update a product   |
| `DELETE` | `/v1/products/:id` | Delete a product   |

**Query filters:** `active`, `ids[]`, `limit`, `starting_after`, `ending_before`

### Prices

| Method | Path             | Description      |
| ------ | ---------------- | ---------------- |
| `GET`  | `/v1/prices`     | List prices      |
| `GET`  | `/v1/prices/:id` | Retrieve a price |
| `POST` | `/v1/prices`     | Create a price   |
| `POST` | `/v1/prices/:id` | Update a price   |

**Query filters:** `active`, `product`, `type`, `currency`, `limit`, `starting_after`, `ending_before`

### Checkout Sessions

| Method | Path                                   | Description             |
| ------ | -------------------------------------- | ----------------------- |
| `POST` | `/v1/checkout/sessions`                | Create a session        |
| `GET`  | `/v1/checkout/sessions`                | List sessions           |
| `GET`  | `/v1/checkout/sessions/:id`            | Retrieve a session      |
| `GET`  | `/v1/checkout/sessions/:id/line_items` | List session line items |
| `POST` | `/v1/checkout/sessions/:id/expire`     | Expire a session        |

### Import / Admin

| Method | Path                  | Description                                        |
| ------ | --------------------- | -------------------------------------------------- |
| `POST` | `/v1/import/reload`   | Reload `products.json` and `prices.json` from disk |
| `POST` | `/v1/import/products` | Bulk import products from request body             |
| `POST` | `/v1/import/prices`   | Bulk import prices from request body               |

---

## Environment Variables

| Variable          | Default                 | Description                                    |
| ----------------- | ----------------------- | ---------------------------------------------- |
| `PORT`            | `4242`                  | Port the server listens on                     |
| `STRIPE_API_KEYS` | `sk_test_mock`          | Comma-separated list of accepted Bearer tokens |
| `BASE_URL`        | `http://localhost:4242` | Used to build session `url` field              |
| `DATA_DIR`        | `./data`                | Path to directory containing JSON data files   |

---

## Publishing to Docker Hub

```bash
# Build the image
docker build -t your-dockerhub-username/sbc-cmo-stripe-mock-api:latest .

# Push
docker push your-dockerhub-username/sbc-cmo-stripe-mock-api:latest
```

Then update `docker-compose.yml` to use the published image:

```yaml
image: your-dockerhub-username/sbc-cmo-stripe-mock-api:latest
```

---

## Project Structure

```
├── src/
│   ├── index.ts             # Express app entry point
│   ├── types/
│   │   └── stripe.ts        # Stripe TypeScript interfaces
│   ├── store/
│   │   └── dataStore.ts     # In-memory data store + JSON loader
│   ├── routes/
│   │   ├── products.ts      # /v1/products
│   │   ├── prices.ts        # /v1/prices
│   │   ├── checkout.ts      # /v1/checkout/sessions
│   │   └── import.ts        # /v1/import
│   ├── middleware/
│   │   ├── auth.ts          # Bearer token validation
│   │   └── errorHandler.ts  # 404 + 500 handlers
│   └── utils/
│       ├── id.ts            # Stripe-style ID generators
│       └── pagination.ts    # Cursor-based list pagination
├── data/                    # Drop products.json / prices.json here
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
