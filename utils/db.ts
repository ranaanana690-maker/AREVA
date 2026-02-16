import { BookmarkEntry } from '../types';

const WATCHLIST_KEY = 'library_watchlist';

// --- Watchlist (LocalStorage) ---

export const getWatchlist = (): BookmarkEntry[] => {
  try {
    const data = localStorage.getItem(WATCHLIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addToWatchlist = (bookmark: BookmarkEntry): BookmarkEntry[] => {
  const list = getWatchlist();
  // Avoid duplicates by bookId
  if (list.some(item => item.bookId === bookmark.bookId)) {
    return list;
  }
  const updated = [bookmark, ...list];
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(updated));
  return updated;
};

export const removeFromWatchlist = (bookId: string): BookmarkEntry[] => {
  const list = getWatchlist().filter(item => item.bookId !== bookId);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  return list;
};

export const clearWatchlist = (): void => {
  localStorage.removeItem(WATCHLIST_KEY);
};
