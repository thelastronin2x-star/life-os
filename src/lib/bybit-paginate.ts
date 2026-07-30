export interface BybitPagedResult<T> {
  list: T[];
  nextPageCursor?: string;
}

/** Walks every page of a cursor-paginated Bybit v5 endpoint, accumulating
 *  `list` across pages until `nextPageCursor` is empty/absent. `maxPages` is
 *  a safeguard against a runaway loop if the API ever misbehaves (e.g. keeps
 *  returning a cursor forever) rather than a real expected limit. */
export async function fetchAllPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<BybitPagedResult<T>>,
  maxPages: number
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    items.push(...result.list);

    if (!result.nextPageCursor) break;
    cursor = result.nextPageCursor;
  }

  return items;
}
