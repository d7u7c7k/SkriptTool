export type InventoryBuilder = {
  inventoryType: string;
  rows: number;
  title: string;
  slots: Record<number, string>;
};
