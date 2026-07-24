export type CatalogItem = {
  id: string;
  label: string;
  /** Path under assets/minecraft/textures/ without .png, e.g. item/golden_apple */
  texture: string;
  labelKo?: string;
};

/** Common Skript item names → vanilla texture paths */
export const itemCatalog: CatalogItem[] = [
  { id: "golden apple", label: "Golden Apple", texture: "item/golden_apple" },
  { id: "enchanted golden apple", label: "Enchanted Golden Apple", texture: "item/enchanted_golden_apple" },
  { id: "diamond sword", label: "Diamond Sword", texture: "item/diamond_sword" },
  { id: "iron sword", label: "Iron Sword", texture: "item/iron_sword" },
  { id: "netherite sword", label: "Netherite Sword", texture: "item/netherite_sword" },
  { id: "bow", label: "Bow", texture: "item/bow" },
  { id: "arrow", label: "Arrow", texture: "item/arrow" },
  { id: "grass block", label: "Grass Block", texture: "block/grass_block_top" },
  { id: "dirt", label: "Dirt", texture: "block/dirt" },
  { id: "stone", label: "Stone", texture: "block/stone" },
  { id: "oak log", label: "Oak Log", texture: "block/oak_log" },
  { id: "oak planks", label: "Oak Planks", texture: "block/oak_planks" },
  { id: "emerald", label: "Emerald", texture: "item/emerald" },
  { id: "diamond", label: "Diamond", texture: "item/diamond" },
  { id: "iron ingot", label: "Iron Ingot", texture: "item/iron_ingot" },
  { id: "gold ingot", label: "Gold Ingot", texture: "item/gold_ingot" },
  { id: "netherite ingot", label: "Netherite Ingot", texture: "item/netherite_ingot" },
  { id: "coal", label: "Coal", texture: "item/coal" },
  { id: "redstone", label: "Redstone", texture: "item/redstone" },
  { id: "lapis lazuli", label: "Lapis Lazuli", texture: "item/lapis_lazuli" },
  { id: "barrier", label: "Barrier", texture: "item/barrier" },
  { id: "paper", label: "Paper", texture: "item/paper" },
  { id: "book", label: "Book", texture: "item/book" },
  { id: "writable book", label: "Writable Book", texture: "item/writable_book" },
  { id: "name tag", label: "Name Tag", texture: "item/name_tag" },
  { id: "compass", label: "Compass", texture: "item/compass" },
  { id: "clock", label: "Clock", texture: "item/clock" },
  { id: "ender pearl", label: "Ender Pearl", texture: "item/ender_pearl" },
  { id: "eye of ender", label: "Eye of Ender", texture: "item/ender_eye" },
  { id: "bread", label: "Bread", texture: "item/bread" },
  { id: "cooked beef", label: "Cooked Beef", texture: "item/cooked_beef" },
  { id: "golden carrot", label: "Golden Carrot", texture: "item/golden_carrot" },
  { id: "potion", label: "Potion", texture: "item/potion" },
  { id: "experience bottle", label: "Experience Bottle", texture: "item/experience_bottle" },
  { id: "totem of undying", label: "Totem of Undying", texture: "item/totem_of_undying" },
  { id: "elytra", label: "Elytra", texture: "item/elytra" },
  { id: "oak door", label: "Oak Door", texture: "item/oak_door" },
  { id: "torch", label: "Torch", texture: "block/torch" },
  { id: "crafting table", label: "Crafting Table", texture: "block/crafting_table_front" },
  { id: "furnace", label: "Furnace", texture: "block/furnace_front" },
  { id: "anvil", label: "Anvil", texture: "block/anvil" },
  { id: "enchanting table", label: "Enchanting Table", texture: "block/enchanting_table_top" },
  { id: "beacon", label: "Beacon", texture: "block/beacon" },
  { id: "spawner", label: "Spawner", texture: "block/spawner" }
];

export function skriptNameToTextureHint(name: string): string {
  const found = itemCatalog.find((item) => item.id === name);
  if (found) {
    return found.texture;
  }
  const snake = name.trim().toLowerCase().replace(/\s+/g, "_");
  return `item/${snake}`;
}

export function vanillaTextureUrl(minecraftVersion: string, texturePath: string): string {
  const version = minecraftVersion || "1.21.4";
  const path = texturePath.replace(/^\/+/, "").replace(/\.png$/i, "");
  return `https://assets.mcasset.cloud/${version}/assets/minecraft/textures/${path}.png`;
}
