import { useEffect, useMemo, useRef, useState } from "react";
import { ItemIcon } from "./ItemIcon";
import { inventoryLayouts } from "./generate";
import { itemCatalog as fallbackCatalog, type CatalogItem } from "./itemCatalog";
import { loadResourcePackFromFile, revokeResourcePack, type LoadedResourcePack } from "./resourcePack";
import type { InventoryBuilder } from "./types";

export type { InventoryBuilder };
export { defaultInventoryBuilder, generateInventoryLines, inventoryLayouts, itemCatalog } from "./generate";

type InventoryToolPanelProps = {
  builder: InventoryBuilder;
  selectedSlots: number[];
  selectedItem: string;
  minecraftVersion: string;
  onBuilderChange: (next: InventoryBuilder) => void;
  onSelectedSlotsChange: (slots: number[]) => void;
  onSelectedItemChange: (item: string) => void;
  onStatus?: (message: string) => void;
  onApply: () => void;
};

type UiCatalogItem = CatalogItem & { labelKo?: string };

export function InventoryToolPanel({
  builder,
  selectedSlots,
  selectedItem,
  minecraftVersion,
  onBuilderChange,
  onSelectedSlotsChange,
  onSelectedItemChange,
  onStatus,
  onApply
}: InventoryToolPanelProps) {
  const packInputRef = useRef<HTMLInputElement>(null);
  const [pack, setPack] = useState<LoadedResourcePack | null>(null);
  const [catalog, setCatalog] = useState<UiCatalogItem[]>(fallbackCatalog);
  const [localVersion, setLocalVersion] = useState<string | null>(null);
  const [loadState, setLoadState] = useState("로컬 .minecraft 텍스처 준비 중…");
  const [filter, setFilter] = useState("");

  const inventoryLayout = inventoryLayouts[builder.inventoryType] ?? inventoryLayouts.chest;
  const inventorySlotCount = builder.inventoryType === "chest" ? builder.rows * 9 : inventoryLayout.slots;
  const inventoryColumnCount = inventoryLayout.columns;
  const inventoryRowCount = Math.ceil(inventorySlotCount / inventoryColumnCount);

  useEffect(() => {
    let cancelled = false;

    async function loadLocal() {
      if (!window.skriptApi?.prepareMinecraftAssets) {
        setLoadState("Electron API 없음 · 기본 카탈로그 사용");
        setCatalog([...fallbackCatalog].sort((a, b) => a.id.localeCompare(b.id, "en")));
        return;
      }

      try {
        setLoadState(`.minecraft에서 ${minecraftVersion} 에셋 로딩…`);
        const assets = await window.skriptApi.prepareMinecraftAssets(minecraftVersion);
        if (cancelled) {
          return;
        }
        setLocalVersion(assets.version);
        setCatalog(
          assets.items.map((item) => ({
            id: item.id,
            label: item.label,
            labelKo: item.labelKo,
            texture: item.texture
          }))
        );
        setLoadState(`.minecraft ${assets.version} · 아이템 ${assets.itemCount}개`);
        onStatus?.(`Loaded ${assets.itemCount} items from ${assets.minecraftPath}`);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLocalVersion(null);
        setCatalog([...fallbackCatalog].sort((a, b) => a.id.localeCompare(b.id, "en")));
        setLoadState(`로컬 로드 실패 · 기본 목록 사용 (${error instanceof Error ? error.message : "error"})`);
      }
    }

    void loadLocal();
    return () => {
      cancelled = true;
    };
  }, [minecraftVersion, onStatus]);

  const visibleItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const sorted = [...catalog].sort((a, b) => a.id.localeCompare(b.id, "en", { sensitivity: "base" }));
    if (!q) {
      return sorted;
    }
    return sorted.filter((item) => {
      const en = item.label.toLowerCase();
      const ko = (item.labelKo ?? "").toLowerCase();
      const id = item.id.toLowerCase();
      return id.includes(q) || en.includes(q) || ko.includes(q);
    });
  }, [catalog, filter]);

  function toggleSlot(slot: number) {
    onSelectedSlotsChange(
      selectedSlots.includes(slot) ? selectedSlots.filter((item) => item !== slot) : [...selectedSlots, slot].sort((a, b) => a - b)
    );
  }

  function setSlotItem(slot: number, item: string) {
    onBuilderChange({
      ...builder,
      slots: { ...builder.slots, [slot]: item }
    });
    if (!selectedSlots.includes(slot)) {
      onSelectedSlotsChange([slot]);
    }
    onStatus?.(`Placed ${item} in slot ${slot}`);
  }

  function moveSlotItem(fromSlot: number, toSlot: number) {
    if (fromSlot === toSlot) {
      return;
    }
    const item = builder.slots[fromSlot];
    if (!item) {
      return;
    }
    const nextSlots = { ...builder.slots, [toSlot]: item };
    delete nextSlots[fromSlot];
    onBuilderChange({ ...builder, slots: nextSlots });
    onSelectedSlotsChange([toSlot]);
    onStatus?.(`Moved item to slot ${toSlot}`);
  }

  function clearSlot(slot: number) {
    const nextSlots = { ...builder.slots };
    delete nextSlots[slot];
    onBuilderChange({ ...builder, slots: nextSlots });
    onStatus?.(`Cleared slot ${slot}`);
  }

  async function handlePackFile(file: File | undefined) {
    if (!file) {
      return;
    }
    try {
      const loaded = await loadResourcePackFromFile(file);
      revokeResourcePack(pack);
      setPack(loaded);
      setLoadState(`리소스팩 ${loaded.name} · ${loaded.textures.size} textures (우선)`);
      onStatus?.(`Loaded resource pack: ${loaded.name}`);
    } catch (error) {
      onStatus?.(`Failed to load resource pack: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  function clearPack() {
    revokeResourcePack(pack);
    setPack(null);
    setLoadState(localVersion ? `.minecraft ${localVersion} · 아이템 ${catalog.length}개` : "바닐라");
    if (packInputRef.current) {
      packInputRef.current.value = "";
    }
  }

  function textureFor(itemId?: string) {
    return catalog.find((item) => item.id === itemId)?.texture ?? `item/${(itemId ?? "barrier").replace(/\s+/g, "_")}`;
  }

  return (
    <>
      <div className="inventory-pack-bar">
        <input
          ref={packInputRef}
          className="hidden-file-input"
          type="file"
          accept=".zip,application/zip"
          onChange={(event) => {
            void handlePackFile(event.target.files?.[0]);
          }}
        />
        <button type="button" className="wide-command" onClick={() => packInputRef.current?.click()}>
          리소스팩 ZIP 불러오기 (선택)
        </button>
        {pack && (
          <button type="button" className="wide-command secondary" onClick={clearPack}>
            리소스팩 해제
          </button>
        )}
        <div className="pack-status">{loadState}</div>
        <div className="pack-hint">기본은 이 PC의 .minecraft 버전 jar 텍스처입니다. 검색은 영어/한글 모두 가능합니다.</div>
      </div>

      <div className="inventory-controls">
        <label>
          <span>GUI</span>
          <select
            value={builder.inventoryType}
            onChange={(event) => onBuilderChange({ ...builder, inventoryType: event.target.value })}
          >
            <option value="chest">Large Chest</option>
            <option value="anvil">Anvil</option>
            <option value="enchanting">Enchanting Table</option>
            <option value="shulker">Shulker Box</option>
          </select>
        </label>
        {builder.inventoryType === "chest" && (
          <label>
            <span>Rows</span>
            <input
              type="number"
              min={1}
              max={6}
              value={builder.rows}
              onChange={(event) => onBuilderChange({ ...builder, rows: Number(event.target.value) })}
            />
          </label>
        )}
        <label>
          <span>Title</span>
          <input value={builder.title} onChange={(event) => onBuilderChange({ ...builder, title: event.target.value })} />
        </label>
      </div>

      <div className="minecraft-window">
        <div className="minecraft-title">{builder.inventoryType === "chest" ? "Large Chest" : inventoryLayout.title}</div>
        <div
          className="minecraft-grid"
          style={{
            gridTemplateColumns: `repeat(${inventoryColumnCount}, 32px)`,
            gridTemplateRows: `repeat(${inventoryRowCount}, 32px)`
          }}
        >
          {Array.from({ length: inventorySlotCount }, (_, slot) => {
            const item = builder.slots[slot];
            const selected = selectedSlots.includes(slot);
            return (
              <button
                className={`minecraft-slot ${selected ? "selected" : ""}`}
                key={slot}
                title={`Slot ${slot}${item ? `: ${item}` : ""}`}
                onClick={() => {
                  if (selectedItem) {
                    setSlotItem(slot, selectedItem);
                  } else {
                    toggleSlot(slot);
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  clearSlot(slot);
                }}
                onDragStart={(event) => {
                  if (!item) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.setData("application/x-skript-item", item);
                  event.dataTransfer.setData("application/x-skript-slot", String(slot));
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={(event) => {
                  if (event.dataTransfer.dropEffect === "none") {
                    clearSlot(slot);
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceSlot = event.dataTransfer.getData("application/x-skript-slot");
                  const droppedItem = event.dataTransfer.getData("application/x-skript-item");
                  if (sourceSlot) {
                    moveSlotItem(Number(sourceSlot), slot);
                    return;
                  }
                  if (droppedItem) {
                    setSlotItem(slot, droppedItem);
                  }
                }}
                draggable={Boolean(item)}
              >
                {item && (
                  <ItemIcon
                    texture={textureFor(item)}
                    localVersion={localVersion}
                    minecraftVersion={minecraftVersion}
                    pack={pack}
                    label={item}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="minecraft-title player-title">Inventory</div>
        <div className="minecraft-grid player-grid">
          {Array.from({ length: 27 }, (_, slot) => (
            <span className="minecraft-slot readonly-slot" key={`player-${slot}`} />
          ))}
        </div>
        <div className="minecraft-grid hotbar-grid">
          {Array.from({ length: 9 }, (_, slot) => (
            <span className="minecraft-slot readonly-slot" key={`hotbar-${slot}`} />
          ))}
        </div>
      </div>

      <div className="selected-summary">
        {visibleItems.length} / {catalog.length} items · {selectedSlots.length} slot(s)
      </div>

      <input
        className="item-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="검색 (영어 / 한글) 예: 다이아, diamond, 사과…"
      />

      <div className="item-palette">
        {visibleItems.map((item) => (
          <button
            className={`palette-item ${selectedItem === item.id ? "active" : ""}`}
            key={item.id}
            onClick={() => onSelectedItemChange(item.id)}
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-skript-item", item.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            title={item.labelKo ? `${item.label} / ${item.labelKo}` : item.label}
            draggable
          >
            <ItemIcon
              texture={item.texture}
              localVersion={localVersion}
              minecraftVersion={minecraftVersion}
              pack={pack}
              label={item.label}
            />
            <span className="palette-item-text">
              <strong>{item.id}</strong>
              <small>{item.labelKo || item.label}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="inventory-actions">
        <button className="apply-button" onClick={onApply}>
          Apply to code
        </button>
        <span className="drag-hint">목록은 A–Z(id) 정렬입니다. 슬롯 클릭으로 배치, 우클릭으로 비우기.</span>
      </div>
    </>
  );
}
