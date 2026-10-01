// Crafting recipes and the shop.
function craftOne(choice, amount) {
  if (!recipes[choice]) {
    print(`'${choice}' is not a recipe!`);
    return;
  }
  if (amount < 1) {
    print("Amount must be at least 1.");
    return;
  }
  const need = recipes[choice],
    miss = [];
  for (const [i, per] of Object.entries(need))
    if ((inventory[i] || 0) < per * amount) miss.push([i, per * amount - (inventory[i] || 0)]);
  if (miss.length) {
    print(`Can't craft ${amount} ${choice}:`);
    miss.forEach(([i, s]) => print(`  Missing ${s} more ${i}.`));
    return;
  }
  print(`\nCrafting ${amount} ${choice}...`);
  for (const [i, per] of Object.entries(need)) removeItem(i, per * amount);
  addItem(choice, amount);
  print(`Successfully crafted ${amount} ${choice}!`);
  if (ITEMS[choice]) print(`Type 'equip ${choice}' to use it: ${describeBuffs(choice)}`);
  else if (USABLE_ITEMS[choice]) print(`Use it during a fight: ${describeUsable(choice)}`);
}
async function showRecipes(arg = "") {
  let term = arg.trim().toLowerCase(),
    cats;
  if (!term) {
    const counts = {};
    Object.keys(recipes).forEach((i) => {
      const c = itemCategory(i);
      counts[c] = (counts[c] || 0) + 1;
    });
    cats = await chooseCategory("Recipe Categories", counts);
    if (!cats) return false;
  } else {
    cats = categoryFilter(term);
    if (!cats) cats = CAT_ORDER;
    else term = "";
  }
  print("\n--- Crafting Recipes ---");
  let shown = 0;
  for (const c of cats) {
    const rows = Object.entries(recipes).filter(
      ([i, ing]) =>
        itemCategory(i) === c &&
        (!term || i.includes(term) || Object.keys(ing).some((g) => g.includes(term)))
    );
    if (!rows.length) continue;
    print(`\n[${c}]`);
    rows.forEach(([i, ing]) =>
      print(
        `  ${Object.entries(ing).every(([k, n]) => (inventory[k] || 0) >= n) ? "*" : "-"} ${i} (${Object.entries(
          ing
        )
          .map(([k, a]) => `${a} ${k}`)
          .join(", ")})`
      )
    );
    shown += rows.length;
  }
  if (!shown) print("(no recipes match)");
  print("\n* = you can craft this right now.");
  print(
    "Filter: 'recipes weapons', 'recipes consumables', 'recipes steel'. 'info <item>' shows details."
  );
  return true;
}
async function craftItem(choice = "") {
  choice = choice.trim().toLowerCase();
  if (!choice) {
    if (!(await showRecipes())) return;
    choice = (await input("\nWhat do you want to craft? (e.g. 'sword' or 'potion 5'): "))
      .trim()
      .toLowerCase();
    if (!choice) return;
  }
  for (const e of choice.split(",")) {
    const [i, a] = parseItemAmount(e);
    if (i) craftOne(i, a);
  }
}
async function shop(arg = "") {
  let term = arg.trim().toLowerCase(),
    mode = null;
  if (term === "buy" || term === "sell") {
    mode = term;
    term = "";
  }
  const names = (
    mode === "buy"
      ? Object.keys(SHOP_BUY)
      : mode === "sell"
        ? Object.keys(SHOP_SELL)
        : [...new Set([...Object.keys(SHOP_BUY), ...Object.keys(SHOP_SELL)])]
  ).sort();
  let cats;
  if (term) {
    cats = categoryFilter(term);
    if (!cats) {
      print(`No shop category '${term}'. Try: consumables, materials, raw, crystals, parts.`);
      return false;
    }
  } else {
    const counts = {};
    names.forEach((n) => {
      const c = itemCategory(n);
      counts[c] = (counts[c] || 0) + 1;
    });
    cats = await chooseCategory("Shop Categories", counts);
    if (!cats) return false;
  }
  print("\n--- Shop ---");
  print(`  ${pad("item", 24)}${rpad("BUY", 6)}${rpad("SELL", 7)}`);
  let shown = 0;
  for (const c of cats) {
    const rows = names.filter((n) => itemCategory(n) === c);
    if (!rows.length) continue;
    print(`\n[${c}]`);
    rows.forEach((n) =>
      print(`  ${pad(n, 24)}${rpad(SHOP_BUY[n] || "-", 6)}${rpad(SHOP_SELL[n] || "-", 7)}`)
    );
    shown += rows.length;
  }
  if (!shown) print("(nothing here)");
  print("\nBUY = what you pay, SELL = what the shop pays you ('-' = not available).");
  print(`(You have ${inventory.coin || 0} coin.)`);
  print("Use 'buy <item> [amount]', 'sell <item> [amount]' or 'sell all <item>'.");
  return true;
}
async function buyItem(arg = "") {
  if (!arg.trim()) {
    if (!(await shop("buy"))) return;
    arg = await input("\nBuy what? (e.g. 'potion 2'): ");
    if (!arg.trim()) return;
  }
  const [item, amount] = parseItemAmount(arg);
  if (!item || amount < 1) {
    print("Try 'buy potion 2'.");
    return;
  }
  if (!SHOP_BUY[item]) {
    print(`The shop doesn't sell '${item}'.`);
    return;
  }
  const cost = SHOP_BUY[item] * amount;
  if ((inventory.coin || 0) < cost) {
    print(`Not enough coin! ${amount} ${item} costs ${cost}.`);
    return;
  }
  removeItem("coin", cost);
  addItem(item, amount);
}
async function sellItem(arg = "") {
  let text = arg.trim().toLowerCase();
  if (!text) {
    const names = groupedNames(
      Object.keys(inventory).filter((n) => inventory[n] > 0 && SHOP_SELL[n])
    );
    if (!names.length) {
      print("You have nothing the shop wants.");
      return;
    }
    print("\n--- Your Sellable Items ---");
    printNumbered(names, (n) => `${n} x${inventory[n]} - ${SHOP_SELL[n]} coin each`);
    const raw = (await input("\nSell what? (number or name [amount], or 'all <item>'): "))
      .trim()
      .toLowerCase();
    if (!raw) return;
    let w = raw.split(/\s+/),
      prefix = "";
    if (w[0] === "all") {
      prefix = "all ";
      w = w.slice(1);
    }
    if (w.length && isDigit(w[0]) && +w[0] >= 1 && +w[0] <= names.length)
      w = [names[+w[0] - 1], ...w.slice(1)];
    text = (prefix + w.join(" ")).trim();
  }
  const all = text.startsWith("all ");
  if (all) text = text.slice(4);
  let [item, amount] = parseItemAmount(text);
  if (!item || amount < 1) {
    print("Try 'sell bone 3' or 'sell all bone'.");
    return;
  }
  if (!SHOP_SELL[item]) {
    print(`The shopkeeper doesn't want '${item}'.`);
    return;
  }
  if (all) amount = inventory[item] || 0;
  if (equipment[ITEMS[item] ? ITEMS[item].id : ""] === item) {
    print(`Unequip your ${item} first.`);
    return;
  }
  if (amount < 1 || (inventory[item] || 0) < amount) {
    print(`You don't have ${amount} ${item}.`);
    return;
  }
  removeItem(item, amount);
  addItem("coin", SHOP_SELL[item] * amount);
}
