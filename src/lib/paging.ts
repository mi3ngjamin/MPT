/** Read every row. PostgREST returns at most 1000 rows unless the client pages with range. */
export async function collectPages<T>(fetchPage: (from: number, to: number) => Promise<T[]>, pageSize = 1000): Promise<T[]> {
  if (pageSize < 1) throw new Error('Page size must be positive.');
  const all: T[] = [];
  const maxPages = 50;
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const batch = await fetchPage(from, from + pageSize - 1);
    all.push(...batch);
    if (batch.length < pageSize) return all;
  }
  throw new Error('The row page limit was exceeded.');
}
