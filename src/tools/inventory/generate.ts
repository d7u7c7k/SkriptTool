import { itemCatalog } from "./itemCatalog";
import type { InventoryBuilder } from "./types";

export { itemCatalog } from "./itemCatalog";

export const inventoryTypes: Record<string, string> = {
  chest: "chest inventory",
  anvil: "anvil inventory",
  enchanting: "enchanting table inventory",
  shulker: "shulker box inventory"
};

export const inventoryLayouts: Record<string, { title: string; slots: number; columns: number }> = {
  chest: { title: "Large Chest", slots: 27, columns: 9 },
  shulker: { title: "Shulker Box", slots: 27, columns: 9 },
  anvil: { title: "Anvil", slots: 3, columns: 3 },
  enchanting: { title: "Enchanting Table", slots: 2, columns: 2 }
};

export const defaultInventoryBuilder: InventoryBuilder = {
  inventoryType: "chest",
  rows: 3,
  title: "상점",
  slots: { 4: "golden apple" }
};

export function generateInventoryLines(builder: InventoryBuilder): string[] {
  const inventoryName = inventoryTypes[builder.inventoryType] ?? "chest inventory";
  const rowsPart = builder.inventoryType === "chest" ? ` with ${builder.rows} row${builder.rows > 1 ? "s" : ""}` : "";
  const slotLines = Object.entries(builder.slots)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([slot, item]) => `set slot ${slot} of player's current inventory to ${item}`);
  return [`open ${inventoryName}${rowsPart} named "${builder.title}" to player`, ...slotLines];
}

export function getCatalogItem(itemId?: string) {
  return itemCatalog.find((catalogItem) => catalogItem.id === itemId);
}
