import { useEffect, useState } from "react";
import { packTextureUrl, remoteTextureUrl, type LoadedResourcePack } from "./resourcePack";

type ItemIconProps = {
  texture: string;
  /** Inline PNG from the local .minecraft jar */
  dataUrl?: string;
  minecraftVersion: string;
  pack: LoadedResourcePack | null;
  label?: string;
  className?: string;
};

export function ItemIcon({ texture, dataUrl, minecraftVersion, pack, label, className }: ItemIconProps) {
  const [failed, setFailed] = useState(false);

  const src = packTextureUrl(texture, pack) ?? dataUrl ?? remoteTextureUrl(texture, minecraftVersion);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <span className={`item-icon item-icon-fallback ${className ?? ""}`} title={label ?? texture}>
        ?
      </span>
    );
  }

  return (
    <img
      className={`item-icon ${className ?? ""}`}
      src={src}
      alt={label ?? texture}
      title={label ?? texture}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
