import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// Electron/오프라인 환경에서도 에디터가 뜨도록 Monaco를 앱에 포함합니다.
(self as unknown as { MonacoEnvironment: { getWorker: () => Worker } }).MonacoEnvironment = {
  getWorker: () => new EditorWorker()
};

loader.config({ monaco });
