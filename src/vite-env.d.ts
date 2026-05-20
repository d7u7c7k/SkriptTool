/// <reference types="vite/client" />

type SkriptFile = {
  path: string;
  name: string;
  content: string;
};

interface Window {
  skriptApi?: {
    openSkript: () => Promise<SkriptFile | null>;
    saveSkript: (payload: { path?: string; content: string }) => Promise<{ path: string; name: string } | null>;
  };
}
