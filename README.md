# Storefront_ProductDetails

Proof of concept for the B2B product details window
(`b2b/detail.asp?SKU=B001-01YM-100A`), rebuilt as a static page so new
features can be tried out before they go into the real
Storefront_ProductDetails view.

## Run it

Open `index.html` in a browser. No build step, no server.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Storefront header/footer plus the detail window and the dialog templates |
| `css/storefront.css` | Page chrome: header, footer, shared buttons and selects |
| `css/product-details.css` | The detail window and its dialogs |
| `js/product-details.js` | All behaviour. One `state` object, one `render()` pass |
| `assets/images/` | Product photos, diamond shape icons, logo, icons pulled from crownring.com |

## What is mocked

The live page talks to `details_act.asp` for most things. Here those are
plain functions in `js/product-details.js` under `mock`:

- ring oversize / undersize fee by size
- stone oversize fee by carat weight (from the internal wholesale fee guide: complimentary under 3.50 ct, $180 for 3.50 to 4.99 ct, $250 for 5.00 to 6.99 ct, $350 for 7.00 ct and up)
- fully-mounted stone price per size option
- estimated ship date from the date needed
- SKU rewrite when metal, diamond size or variation changes

SPIFF salespersons and the "add to list" lists are hard-coded sample data.

## Known gaps

- The three alternate-view photos are not publicly served, so they are
  placeholder tiles. Drop the real files in `assets/images/products/` and set
  `data-image` on the `.pd-thumb--placeholder` elements.
- "Print this page for retail" opens the normal print dialog; the retail
  print layout is not rebuilt.
- The matching band thumbnail shows a toast instead of loading the band.
