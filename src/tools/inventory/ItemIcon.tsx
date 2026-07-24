import { useEffect, useState } from "react";
import { resolveTextureUrl, type LoadedResourcePack } from "./resourcePack";

type ItemIconProps = {
  texture: string;
  /** Resolved local jar version used for mctex:// */
  localVersion?: string | null;
  minecraftVersion: string;
  pack: LoadedResourcePack | null;
  label?: string;
  className?: string;
};

function localTextureSrc(localVersion: string, texture: string) {
  const key = texture.replace(/^\/+/, "").replace(/\.png$/i, "");
  return `mctex://local/${key}.png?v=${encodeURIComponent(localVersion)}`;
}

export function ItemIcon({ texture, localVersion, minecraftVersion, pack, label, className }: ItemIconProps) {
  const [failed, setFailed] = useState(false);

  const src = pack
    ? resolveTextureUrl(texture, minecraftVersion, pack)
    : localVersion
      ? localTextureSrc(localVersion, texture)
      : resolveTextureUrl(texture, minecraftVersion, null);

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
