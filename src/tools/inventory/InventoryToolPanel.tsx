import { useEffect, useMemo, useRef, useState } from "react";
import { ItemIcon } from "./ItemIcon";
import { inventoryLayouts } from "./generate";
import { itemCatalog as fallbackCatalog, type CatalogItem } from "./itemCatalog";
import { loadResourcePackFromFile, revokeResourcePack, type LoadedResourcePack } from "./resourcePack";
import type { InventoryBuilder } from "./types";

export type { InventoryBuilder };
export { defaultInventoryBuilder, generateInventoryLines, inventoryLayouts, itemCatalog } from "./generate";

const MAX_VISIBLE = 240;

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

type UiCatalogItem = CatalogItem & { labelKo?: string; dataUrl?: string };

type LoadState =
  | { kind: "loading"; message: string }
  | { kind: "local"; version: string; count: number }
  | { kind: "fallback"; message: string };

/** Ignore spaces so "황금사과" matches "황금 사과". */
function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

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
  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading", message: ".minecraft 에셋 확인 중…" });
  const [filter, setFilter] = useState("");

  const inventoryLayout = inventoryLayouts[builder.inventoryType] ?? inventoryLayouts.chest;
  const inventorySlotCount = builder.inventoryType === "chest" ? builder.rows * 9 : inventoryLayout.slots;
  const inventoryColumnCount = inventoryLayout.columns;
  const inventoryRowCount = Math.ceil(inventorySlotCount / inventoryColumnCount);

  useEffect(() => {
    let cancelled = false;
    const prepare = window.skriptApi?.prepareMinecraftAssets;

    if (!prepare) {
      setLoadState({ kind: "fallback", message: "Electron에서 실행해야 .minecraft 텍스처를 쓸 수 있습니다." });
      return;
    }

    setLoadState({ kind: "loading", message: `.minecraft에서 ${minecraftVersion} 에셋 로딩…` });

    prepare(minecraftVersion)
      .then((assets) => {
        if (cancelled) {
          return;
        }
        setCatalog(assets.items);
        setLoadState({ kind: "local", version: assets.version, count: assets.itemCount });
        onStatus?.(`Loaded ${assets.itemCount} items from .minecraft ${assets.version}`);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setCatalog(fallbackCatalog);
        setLoadState({ kind: "fallback", message });
        onStatus?.(`.minecraft 로드 실패: ${message}`);
      });

    return () => {
      cancelled = true;
    };
  }, [minecraftVersion, onStatus]);

  const sortedCatalog = useMemo(
    () => [...catalog].sort((a, b) => a.id.localeCompare(b.id, "en", { sensitivity: "base" })),
    [catalog]
  );

  const matches = useMemo(() => {
    const query = normalize(filter.trim());
    if (!query) {
      return sortedCatalog;
    }
    return sortedCatalog.filter(
      (item) =>
        normalize(item.id).includes(query) ||
        normalize(item.label).includes(query) ||
        normalize(item.labelKo ?? "").includes(query)
    );
  }, [sortedCatalog, filter]);

  const visibleItems = matches.slice(0, MAX_VISIBLE);

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
      onStatus?.(`Loaded resource pack: ${loaded.name} (${loaded.textures.size} textures)`);
    } catch (error) {
      onStatus?.(`리소스팩 로드 실패: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  function clearPack() {
    revokeResourcePack(pack);
    setPack(null);
    if (packInputRef.current) {
      packInputRef.current.value = "";
    }
  }

  function itemFor(itemId?: string) {
    return catalog.find((item) => item.id === itemId);
  }

  const sourceLabel =
    loadState.kind === "local"
      ? `.minecraft ${loadState.version} · 아이템 ${loadState.count}개`
      : loadState.kind === "loading"
        ? loadState.message
        : `기본 목록 사용 · ${loadState.message}`;

  return (
    <>
      <div className="inventory-pack-bar">
        <div className={`pack-status ${loadState.kind === "fallback" ? "warn" : ""}`}>{sourceLabel}</div>
        {pack && <div className="pack-status">리소스팩 {pack.name} · {pack.textures.size} textures (우선 적용)</div>}
        <input
          ref={packInputRef}
          className="hidden-file-input"
          type="file"
          accept=".zip,application/zip"
          onChange={(event) => {
            void handlePackFile(event.target.files?.[0]);
          }}
        />
        <div className="pack-buttons">
          <button type="button" className="wide-command" onClick={() => packInputRef.current?.click()}>
            리소스팩 ZIP 불러오기
          </button>
          {pack && (
            <button type="button" className="wide-command secondary" onClick={clearPack}>
              해제
            </button>
          )}
        </div>
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
            const itemId = builder.slots[slot];
            const item = itemFor(itemId);
            const selected = selectedSlots.includes(slot);
            return (
              <button
                className={`minecraft-slot ${selected ? "selected" : ""}`}
                key={slot}
                title={`Slot ${slot}${itemId ? `: ${itemId}` : ""}`}
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
                  if (!itemId) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.setData("application/x-skript-item", itemId);
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
                draggable={Boolean(itemId)}
              >
                {itemId && (
                  <ItemIcon
                    texture={item?.texture ?? `item/${itemId.replace(/\s+/g, "_")}`}
                    dataUrl={item?.dataUrl}
                    minecraftVersion={minecraftVersion}
                    pack={pack}
                    label={itemId}
                    className="slot-icon"
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

      <input
        className="item-filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="아이템 검색 (한글/영어): 다이아몬드, golden apple…"
      />

      <div className="selected-summary">
        {matches.length}개 검색됨
        {matches.length > visibleItems.length ? ` · ${visibleItems.length}개 표시` : ""} · 선택한 아이템:{" "}
        {selectedItem || "없음"}
      </div>

      <div className="item-palette">
        {visibleItems.length === 0 ? (
          <div className="empty-note">검색 결과가 없습니다.</div>
        ) : (
          visibleItems.map((item) => (
            <button
              className={`palette-item ${selectedItem === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => onSelectedItemChange(item.id)}
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-skript-item", item.id);
                event.dataTransfer.effectAllowed = "copy";
              }}
              title={item.labelKo ? `${item.id} · ${item.labelKo}` : item.id}
              draggable
            >
              <ItemIcon
                texture={item.texture}
                dataUrl={item.dataUrl}
                minecraftVersion={minecraftVersion}
                pack={pack}
                label={item.label}
              />
              <span className="palette-item-text">
                <strong>{item.id}</strong>
                <small>{item.labelKo || item.label}</small>
              </span>
            </button>
          ))
        )}
      </div>

      <div className="inventory-actions">
        <button className="apply-button" onClick={onApply}>
          코드에 적용
        </button>
        <span className="drag-hint">목록은 A–Z 정렬입니다. 아이템을 고른 뒤 슬롯 클릭으로 배치, 우클릭으로 비우기.</span>
      </div>
    </>
  );
}
