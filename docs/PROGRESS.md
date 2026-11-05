# KadaBook: Kitchen, Stock and Branches progress

Every change for the Kitchen / Stock / Branches scope is noted here, newest step last.

Checks after each step:

```powershell
npm run typecheck     # tsc
npm run test:stock    # stock engine and the owner's acceptance test
npm run test:rules    # Firestore rules, on a local emulator (never touches live data)
```

First time only: `npm install --prefix firebase/tests`

## Step 1: stock engine and test harness

- `src/lib/stockEngine.ts`: every stock change planned as a pure function (purchase, send with
  assemble preview, make, sale, return, wastage, count) plus the seed list and recipes.
- `src/data/kitchenTypes.ts`: `ItemKind`, `StockRow`, new ledger types. The ledger keeps its
  existing names: `transferOut/In` = transfer_out/in, `assembleOut/In` = assemble_out/in,
  `productionOut/In` = production_out/in, `adjust` = adjustment.
- `firebase/tests/`: tests moved into the repo, with their own `package.json` so test libraries
  stay out of the app.

Checked: tsc clean, 20 of 20 stock checks.

## Step 2: data layer

- `src/firebase/client.ts`: `readStockRows` / `writeStockPlan`; a bill and its stock change in one
  transaction; the cost is frozen on the sale line; bill returns put stock back at that branch.
- `src/data/kitchenRepo.ts`: `applyStock` runs any plan in a transaction; stock and ledger listeners;
  staff tied to a branch only query that branch. Reports read the last 62 days of the ledger.
- `src/data/localStock.ts`: same behaviour for phone-only shops.
- Migration, on the owner's phone, once: `backfillStock` builds stock rows from the old ledger and moves
  stock held on old linked products to Main; `linkProducts` links them; `stampBranch` writes the main
  branch on rows with no branchId, because staff queries need the field.
- Fixed in passing: `normalizeProduct` dropped `sellKind`, which kept re-saving food products.

## Step 3: rules

- `firebase/firestore.rules`: `stock/{branchId}_{itemId}`; the ledger is append only; a cashier can only
  lower stock (sale) at their branch; staff tied to a branch can read only that branch's sales, expenses,
  credit payments, returns, drafts, days, stock and ledger; staff list and audit log closed to them.
- Found by the emulator: a sale's transaction reads rows that do not exist yet, which the first version
  of the rule refused. Fixed with a separate `get` rule.

Checked: 158 of 158, including the owner's acceptance flow as real transactions under the rules.

## Step 4: screens

- `src/screens/KitchenScreen.tsx`, `src/components/kitchen/KitchenForms.tsx`: rebuilt. Tabs: Stock, Items,
  Moves, Pay, Report. Forms: Buy, Send (with the assemble preview and editable N), Make, Count, Waste, Item
  (with recipe). The burger shop list is one tap on Items, and everything stays editable.
- Removed: product recipes, Produce, To Foods, and deleting ledger entries.
- `src/screens/ProductsScreen.tsx`: link a product to a stock item, with a portion size for gram items.
- `src/screens/NewSaleScreen.tsx`: tiles show the current branch's stock; linked products are never blocked
  and show "Fridge shows N"; raw materials are never deducted on sale.
- `src/components/BranchStockCard.tsx`: Home card, and the branch report on Reports and Kitchen.
- One branch = no branch UI: the staff screen hides its branch picker too.

## Step 5: daily report fixes

- Profit takes off running expenses only. Stock purchases and supplier payments are shown apart. Applied to
  the daily report, Home's monthly profit, the month table and the printed period report.
- Cash in drawer = opening + cash sales + cash collected on credit − cash expenses − cash purchases. Card
  sales and card credit payments are left out.
- Home: Today's Sales is sales only, and "Cash in drawer" is its own line. Opening is never added to sales.

Checked: `npm run test:daily`.

## Step 6: Mr Chef kitchen catalog (kitchen shops only)

- `src/lib/mrChefCatalog.ts`: exact 12 buy items + full sell menu (burgers, subs, sides, drinks) with
  menu prices. Nothing else is seeded.
- `seedBurgerShop` now replaces: deletes this shop's products, clears materials/stock/recipes, writes the
  12 items, then the Mr Chef products. Cheese Balls and Popcorn Chicken link to stock. Blocked for
  retail shop type.
- Kitchen Items: "Load Mr Chef list" with confirm; removed the standard raw-materials catalog chip.
- Stock tests use `BURGER_SHOP_TEST_ITEMS` (12 + finished recipes) so engine acceptance still passes.

Checked: `npm run typecheck`, `npm run test:stock` (20/20).

## Step 9: Icon Buy / Add foods

- Shared `ItemIconGrid` (dashboard-style tiles by kind: R / F / D).
- Buy stock: tap item → qty + cost → cart → Cash / Credit / Stock only → Save.
- Add foods: same icon grid for finished items + qty + recipe needs.

## Step 8: Kitchen dashboard (kitchen shops only)

- Kitchen Stock tab uses the same Home dashboard language: `GradientStatCard`, `HomeActionTile`,
  brand panel, duo icons, branch fridge card.
- Actions: Buy, Send, Add foods (Make), Count, Items, Moves, Waste, Report.
- Retail shop type hitting Kitchen sees a block message; no retail code paths changed.

## Step 7: Mr Chef recipes

- Seeded 6 finished items: Chicken / Crispy / Veg / Hum Burger, Drumstick Bun, Hot Dog Bun.
- Recipes use the 12 buy names (e.g. Chicken burger (patty)). Make 50 ⇒ 50 bun + 50 filling.
- Products linked: Chicken Burger, Crispy Chicken Burger → Crispy Burger, Vegetable → Veg Burger,
  Hum Burger, Drumstick Bun, Hot Dog Bun (+ Cheese Balls, Popcorn Chicken).

Checked: `npm run typecheck`, `npm run test:stock`.

## Known limits

- Offline: Firestore transactions need a connection, so a linked bill cannot save offline.
- Products with no stock link keep the old rule: out of stock blocks the sale.
- Shop-wide data a branch cashier can still read: product list and prices, customers, stock item names,
  branch names, and older opening balances on the shop profile.
- Credit: a cashier tied to a branch sees and settles only that branch's bills, so a customer's balance
  there can differ from the owner's shop-wide figure.
- Counting needs the "Kitchen & stock" tick, so a cashier needs it switched on to do the day-end count.
