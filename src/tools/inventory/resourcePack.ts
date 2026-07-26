import { unzipSync } from "fflate";

export type LoadedResourcePack = {
  name: string;
  /** texture key (item/foo) → blob: URL */
  textures: Map<string, string>;
};

const TEXTURE_IN_PACK = /(?:^|\/)assets\/minecraft\/textures\/((?:item|block)\/[^/]+)\.png$/i;

function normalizeKey(texturePath: string) {
  return texturePath.replace(/^\/+/, "").replace(/\.png$/i, "").toLowerCase();
}

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
    const blob = new Blob([new Uint8Array(data)], { type: "image/png" });
    textures.set(match[1].toLowerCase(), URL.createObjectURL(blob));
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

export function packTextureUrl(texturePath: string, pack: LoadedResourcePack | null): string | null {
  return pack?.textures.get(normalizeKey(texturePath)) ?? null;
}

/** Last resort when no local jar and no pack is available. */
export function remoteTextureUrl(texturePath: string, minecraftVersion: string): string {
  const version = minecraftVersion || "1.21.4";
  return `https://assets.mcasset.cloud/${version}/assets/minecraft/textures/${normalizeKey(texturePath)}.png`;
}
