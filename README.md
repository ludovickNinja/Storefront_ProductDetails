# Storefront_ProductDetails

Proof of concept for the B2B product details window (`b2b/detail.asp`),
rebuilt as a static page so new features can be tried out before they go
into the real Storefront_ProductDetails view. Two products are wired in and
the Item # in the title bar switches between them:

- `B001-01YM-100A`, a Noam Carver engagement ring (center stone options)
- `RYL-008RD6-M10`, a Bleu Royale wedding band (fixed metal, width, $30 per
  full size above 12.75, complimentary engraving)

Products live in the `products` table in the script; each has a product type.

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
- fully-mounted lab center sizes per shape (IGI Certified labels with the shape's ratio range, 1.00 to 5.00 ct) and their prices
- estimated ship date from the date needed
- SKU rewrite when metal, diamond size or variation changes

The Customize menu lists every customization from the internal wholesale
fee guide with its fee (`defaultCatalogue` in the script) that applies to
the current product's type. The title bar "menu" opens **Customization
settings**, an editor for the product types (Engagement Ring, Wedding Band,
Stackable, Earrings, Necklace by default), the categories, the
customizations in each, their fee (flat, complimentary or quote required),
the reference-only flag and the product types each one applies to. Edits are saved in the browser's localStorage
(clear that key to return to the defaults). The window has no close
control; the POC always shows it. Flat fees
are added to the Total Wholesale Price; "Quote required" items are flagged
under the total instead. Items flagged `reference: true` (Retipping prongs)
are listed with their fee but cannot be selected. Center stone size changes
are not in the menu since that fee already comes from the carat weight of
the center stone provided.

Total Wholesale Price = ring wholesale price + ring oversize/undersize fee
+ lab center stone (fully mounted only) + stone oversize fee + center stone
setting fee ($80 when "Sending Center Stone for Setting" is Yes, unmounted
only) + engraving fee + customization fees.

SPIFF salespersons and the "add to list" lists are hard-coded sample data.

## Known gaps

- The engagement ring's three alternate-view photos are not publicly
  served, so they are placeholder tiles. Drop the real files in
  `assets/images/products/` and list them in the product's `images`.
- "Print this page for retail" opens the normal print dialog; the retail
  print layout is not rebuilt.
- The matching band thumbnail shows a toast instead of loading the band.
