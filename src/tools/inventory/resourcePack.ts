import { unzipSync } from "fflate";

export type LoadedResourcePack = {
  name: string;
  /** texture path (item/foo) → blob: URL */
  textures: Map<string, string>;
};

const TEXTURE_IN_PACK = /(?:^|\/)assets\/minecraft\/textures\/((?:item|block)\/[^/]+)\.png$/i;

/** Parse a Minecraft resource pack ZIP and extract item/block PNG textures. */
export async function loadResourcePackFromFile(file: File): Promise<LoadedResourcePack> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = unzipSync(bytes);
  const textures = new Map<string, string>();

  for (const [rawPath, data] of Object.entries(entries)) {
    const path = rawPath.replace(/\\/g, "/");
    const match = path.match(TEXTURE_IN_PACK);
    if (!match || !data?.length) {
      continue;
    }
    const key = match[1].toLowerCase();
    const copy = new Uint8Array(data);
    const blob = new Blob([copy], { type: "image/png" });
    textures.set(key, URL.createObjectURL(blob));
  }

  return { name: file.name, textures };
}

export function revokeResourcePack(pack: LoadedResourcePack | null) {
  if (!pack) {
    return;
  }
  for (const url of pack.textures.values()) {
    URL.revokeObjectURL(url);
  }
}

export function resolveTextureUrl(
  texturePath: string,
  minecraftVersion: string,
  pack: LoadedResourcePack | null
): string {
  const key = texturePath.replace(/^\/+/, "").replace(/\.png$/i, "").toLowerCase();
  const fromPack = pack?.textures.get(key);
  if (fromPack) {
    return fromPack;
  }
  const version = minecraftVersion || "1.21.4";
  return `https://assets.mcasset.cloud/${version}/assets/minecraft/textures/${key}.png`;
}
