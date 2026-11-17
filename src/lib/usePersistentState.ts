import { useEffect, useState } from "react";

/**
 * localStorage에 저장되는 상태. normalize가 있으면 불러온 값을 검증/보정합니다.
 */
export function usePersistentState<T>(key: string, initial: T, normalize?: (value: unknown) => T | null) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return initial;
      }
      const parsed: unknown = JSON.parse(raw);
      if (normalize) {
        return normalize(parsed) ?? initial;
      }
      return parsed as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장 공간이 없어도 앱은 계속 동작합니다. */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
