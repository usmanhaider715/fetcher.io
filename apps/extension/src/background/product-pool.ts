export async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  shouldStop?: () => boolean,
): Promise<void> {
  if (items.length === 0) return;

  let index = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      if (shouldStop?.()) break;
      const current = index++;
      if (current >= items.length) break;
      await fn(items[current]!);
    }
  });

  await Promise.all(workers);
}
