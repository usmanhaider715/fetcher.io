# Fetcher.io API Documentation

Base URL: `http://127.0.0.1:3847`

## Health

### `GET /health`
Returns server status.

```json
{ "status": "ok", "service": "fetcher-io-backend", "version": "1.0.0" }
```

## Scraping

### `POST /scrape`
Start a scraping session.

**Body:**
```json
{
  "mode": "current_product",
  "websiteUrl": "https://example.com/product/1",
  "products": [{ "title": "Product", "price": 29.99, "imageUrls": ["https://..."] }],
  "categoryId": "uuid",
  "subcategoryId": "uuid"
}
```

### `POST /scrape/download`
Save a single product with image downloads.

**Body:**
```json
{
  "product": { "title": "...", "imageUrls": ["..."] },
  "sessionId": "uuid",
  "categoryId": "uuid",
  "subcategoryId": "uuid"
}
```

### `GET /scrape/progress/:sessionId`
Get session progress.

### `POST /scrape/pause/:sessionId`
Pause a session.

### `POST /scrape/stop/:sessionId`
Stop a session.

### `POST /scrape/resume`
Resume a session. Body: `{ "sessionId": "uuid" }`

## Export

### `POST /export`
Export products.

**Body:**
```json
{
  "format": "json",
  "sessionId": "uuid",
  "productIds": ["uuid"]
}
```

Formats: `txt`, `json`, `csv`, `excel`, `zip`

## Categories

### `GET /categories`
List all categories with subcategories.

### `POST /categories`
Create category. Body: `{ "name": "Electronics" }`

### `POST /categories/:categoryId/subcategories`
Create subcategory. Body: `{ "name": "Phones" }`

### `DELETE /categories/:id`
Delete a category.

## Products

### `GET /products`
List products. Query: `sessionId`, `limit`, `offset`

### `GET /products/:id`
Get product with images.

## Settings

### `GET /settings`
Get application settings.

### `PUT /settings`
Update settings.

## Logs

### `GET /logs`
Get logs. Query: `sessionId`, `limit`
