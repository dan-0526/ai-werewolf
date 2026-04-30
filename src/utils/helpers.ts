// 工具函数

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shuffleArray<T>(arr: T[], seed?: number): T[] {
  const result = [...arr];
  // 简单的 seeded random（Fisher-Yates）
  let rng = seed != null ? seededRandom(seed) : Math.random;
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function majorityVote(votes: number[]): number | null {
  if (votes.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of votes) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  const winners = [...counts.entries()].filter(([, c]) => c === maxCount).map(([id]) => id);
  if (winners.length === 1) return winners[0];
  // 平票：随机选一个
  return winners[Math.floor(Math.random() * winners.length)];
}

export function isTie(votes: number[]): boolean {
  if (votes.length === 0) return false;
  const counts = new Map<number, number>();
  for (const v of votes) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  return [...counts.values()].filter((c) => c === maxCount).length > 1;
}
