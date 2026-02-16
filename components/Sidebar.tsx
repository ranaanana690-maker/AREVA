import React from 'react';
import { BookmarkEntry } from '../types';
import { removeFromWatchlist, clearWatchlist } from '../utils/db';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: BookmarkEntry[];
  setWatchlist: (list: BookmarkEntry[]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, watchlist, setWatchlist }) => {

  const handleDelete = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    const updated = removeFromWatchlist(bookId);
    setWatchlist(updated);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("سيتم مسح جميع الكتب المحفوظة. هل أنت متأكد؟")) {
      clearWatchlist();
      setWatchlist([]);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-20"
          onClick={onClose}
        ></div>
      )}

      <div className={`
        fixed md:relative z-30
        h-full bg-white border-l border-[#d0d0d0]
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isOpen ? 'w-[280px] translate-x-0' : 'w-0 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden'}
      `}>
        <div className="p-4 border-b border-[#d0d0d0] flex justify-between items-center bg-[#f9f9f9] flex-shrink-0">
          <h2 className="font-bold text-[#28a745] flex items-center gap-2">
            <i className="fas fa-bookmark text-sm"></i>
            الكتب المحفوظة
          </h2>
          <button onClick={onClose} className="md:hidden text-gray-500 p-2 hover:bg-gray-200 rounded-full">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {watchlist.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-10 px-4">
              <i className="fas fa-bookmark text-3xl mb-3 block opacity-30"></i>
              <p>لا توجد كتب محفوظة بعد</p>
              <p className="text-xs mt-1 opacity-70">ابحث عن كتاب واضغط "حفظ" لإضافته هنا</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {watchlist.map(item => (
                <div
                  key={item.bookId}
                  className="relative p-3 rounded-lg bg-white border border-gray-100 hover:border-[#28a745]/30 hover:bg-[#f0faf0] transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <i className="fas fa-book text-[#28a745] text-sm mt-0.5 flex-shrink-0"></i>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[#333] font-medium block truncate" title={item.title}>
                        {item.title}
                      </span>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>🔖 {item.bookId}</span>
                        <span>📂 رف {item.list}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, item.bookId)}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="إزالة"
                      aria-label="إزالة"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {watchlist.length > 0 && (
          <div className="p-3 border-t border-[#d0d0d0] bg-[#f9f9f9] flex-shrink-0">
            <button
              onClick={handleClearAll}
              className="w-full text-red-500 hover:text-red-700 text-sm hover:bg-red-50 py-2 rounded transition-colors flex items-center justify-center gap-2 border border-transparent hover:border-red-100"
            >
              <i className="fas fa-trash"></i> مسح الكل
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;