/// <reference types="vite/client" />

type SkriptFile = {
  path: string;
  name: string;
  content: string;
};

interface FileSystemFileHandle {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

interface Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<FileSystemFileHandle>;
  skriptApi?: {
    openSkript: () => Promise<SkriptFile | null>;
    saveSkript: (payload: { path?: string; content: string }) => Promise<{ path: string; name: string } | null>;
  };
}
