# User Guide

## Installation

1. Install Node.js 20+ and pnpm
2. Clone the repository
3. Run `pnpm install && pnpm db:push && pnpm build`
4. Start the backend: `pnpm dev:backend`
5. Load the Chrome extension from `apps/extension/dist`

## Quick Start

1. Navigate to any e-commerce product page
2. Click the Fetcher.io extension icon
3. Click **Start Scraping** to scrape the current product
4. Products are saved locally with images in `apps/backend/data/products/`

## Scraping Modes

| Mode | Description |
|------|-------------|
| Current Product | Scrape the product on the active page |
| Current Collection | Scrape all products visible in a collection/category page |
| Entire Website | Crawl the full website (advanced) |
| Selected URLs | Scrape a manually entered list of URLs |
| Import CSV | Import product URLs from a CSV file |
| Resume Session | Continue an interrupted scraping session |

## Side Panel

Open the side panel for advanced controls:
- Select scraping mode
- Record custom CSS selectors
- Manage categories and subcategories
- Export data (JSON, CSV, Excel, TXT, ZIP)

## Selector Recorder

1. Open the side panel
2. Click **Record Selector**
3. Choose a field (Title, Price, Image, etc.)
4. Click the corresponding element on the page
5. Click **Save** to store the selector

## Categories

Organize products into categories and subcategories:
- Create categories like "Electronics" → "Phones"
- Products are stored in matching folder structures
- Product IDs follow `EL-PH-000001` format by default

## Settings

Access via the extension popup → **Settings** or right-click → Options.

Key settings:
- **Backend URL**: Default `http://localhost:3847`
- **Products Folder**: Root directory for saved products
- **Concurrent Downloads**: Parallel image downloads (1-20)
- **Delay**: Time between requests (with optional randomization)
- **Product ID Format**: Category-based or UUID
- **Image Processing**: Compression, resize, thumbnails

## File Output

Each product is saved as:

```
Products/
  Electronics/
    Phones/
      EL-PH-000001_Product_Name/
        details.txt
        details.json
        images/
          cover.jpg
          image_01.jpg
        videos/
        documents/
```

## Exporting

Use the Export panel in the side panel to export:
- **JSON** — Full product data
- **CSV** — Spreadsheet-compatible
- **Excel** — .xlsx file
- **TXT** — Human-readable summary
- **ZIP** — Complete products folder archive

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension can't connect | Ensure backend is running (`pnpm dev:backend`) |
| No products detected | Try selector recorder for custom sites |
| Images not downloading | Check network, increase retry count in settings |
| Duplicate products | Adjust duplicate detection in settings |
