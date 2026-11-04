/** Slice a full array for client-side paging. Returns { rows, pages, page } with page clamped into range. */
export const paginate = (items, page, size) => {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: items.slice((p - 1) * size, p * size), pages, page: p };
};
