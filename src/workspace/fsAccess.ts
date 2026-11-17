export type WritableLike = {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
};

export type FileHandleLike = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<WritableLike>;
};

export type DirectoryHandleLike = {
  kind: "directory";
  name: string;
  values: () => AsyncIterableIterator<FileHandleLike | DirectoryHandleLike>;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<DirectoryHandleLike>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileHandleLike>;
};

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite"; id?: string }) => Promise<DirectoryHandleLike>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileHandleLike>;
};

export function supportsDirectoryPicker(): boolean {
  return typeof (window as PickerWindow).showDirectoryPicker === "function";
}

export function supportsSaveFilePicker(): boolean {
  return typeof (window as PickerWindow).showSaveFilePicker === "function";
}

export async function pickDirectory(): Promise<DirectoryHandleLike> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error("이 브라우저는 폴더 열기를 지원하지 않습니다.");
  }
  return picker({ mode: "readwrite", id: "skripttool-workspace" });
}

export async function pickSaveFile(suggestedName: string): Promise<FileHandleLike> {
  const picker = (window as PickerWindow).showSaveFilePicker;
  if (!picker) {
    throw new Error("이 브라우저는 다른 이름으로 저장을 지원하지 않습니다.");
  }
  return picker({
    suggestedName,
    types: [{ description: "Skript 파일", accept: { "text/plain": [".sk"] } }]
  });
}
