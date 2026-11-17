/** "2.10.0" 처럼 점으로 구분된 버전을 비교합니다. a > b 이면 양수. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(/[._-]/).map((part) => Number.parseInt(part, 10));
  const right = b.split(/[._-]/).map((part) => Number.parseInt(part, 10));
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.isFinite(left[index]) ? left[index] : 0;
    const rightPart = Number.isFinite(right[index]) ? right[index] : 0;
    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }
  return 0;
}

export function atLeast(version: string, minimum: string): boolean {
  return compareVersions(version, minimum) >= 0;
}
