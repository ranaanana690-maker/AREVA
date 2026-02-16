import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { libraryData } from '../data/libraryData';

interface MessageBubbleProps {
  message: Message;
  onBookmark?: (bookId: string, title: string, list: string) => void;
}

// Build a lookup map for quick book matching
const bookMap = new Map(libraryData.books.map(b => [b.id, b]));

// Extract all book IDs from text
const extractBooksFromText = (text: string): { id: string; title: string; list: string }[] => {
  const results: { id: string; title: string; list: string }[] = [];
  const idMatches = text.match(/\b([ABC]\d{2,3})\b/gi);
  if (idMatches) {
    const uniqueIds = [...new Set(idMatches.map(m => m.toUpperCase()))];
    for (const id of uniqueIds) {
      const book = bookMap.get(id);
      if (book) {
        results.push({ id: book.id, title: book.title, list: book.list });
      }
    }
  }
  return results;
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onBookmark }) => {
  const isBot = message.sender === 'bot';
  const isError = message.isError;
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const books = isBot && !isError ? extractBooksFromText(message.text) : [];

  const handleSave = (bookId: string, title: string, list: string) => {
    if (onBookmark) {
      onBookmark(bookId, title, list);
      setSavedIds(prev => new Set(prev).add(bookId));
    }
  };

  return (
    <div
      className={`relative w-fit max-w-[85%] px-4 py-3 rounded-[18px] text-[0.95em] leading-relaxed shadow-sm break-words
        ${isBot
          ? `bg-[#e6f7eb] text-[#333] rounded-br-[4px] self-start mr-auto ${isError ? '!bg-[#f8d7da] !text-[#721c24] border border-[#f5c6cb]' : ''}`
          : 'bg-white text-[#333] border border-[#d0d0d0] rounded-bl-[4px] self-end ml-auto'
        }
      `}
    >
      <div className="markdown-content text-right" dir="rtl">
        <ReactMarkdown
          components={{
            p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0" {...props} />,
            a: ({ node, ...props }) => <a className="text-[#007bff] underline underline-offset-2 hover:text-[#0056b3]" target="_blank" rel="noopener noreferrer" {...props} />,
            ul: ({ node, ...props }) => <ul className="mr-5 pr-4 mb-3 list-disc" {...props} />,
            ol: ({ node, ...props }) => <ol className="mr-5 pr-4 mb-3 list-decimal" {...props} />,
            li: ({ node, ...props }) => <li className="mb-1.5 last:mb-0" {...props} />,
            code: ({ node, ...props }) => <code className="bg-black/5 px-1.5 py-0.5 rounded font-mono text-[0.9em] inline-block dir-ltr" {...props} />,
            blockquote: ({ node, ...props }) => <blockquote className="border-r-4 border-[#28a745] my-3 py-2 pr-4 pl-2 bg-black/5 rounded italic" {...props} />,
            strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />
          }}
        >
          {message.text}
        </ReactMarkdown>
      </div>

      {/* Bookmark buttons for detected books */}
      {books.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-[#28a745]/20">
          {books.map(book => (
            <button
              key={book.id}
              onClick={() => handleSave(book.id, book.title, book.list)}
              disabled={savedIds.has(book.id)}
              className={`text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all duration-300
                ${savedIds.has(book.id)
                  ? 'bg-[#28a745]/15 text-[#28a745] cursor-default scale-95'
                  : 'bg-white/90 text-[#28a745] border border-[#28a745]/30 hover:bg-[#28a745] hover:text-white hover:shadow-md cursor-pointer active:scale-90'
                }
              `}
              title={savedIds.has(book.id) ? `✅ تم حفظ ${book.title}` : `📌 حفظ ${book.title} في قائمتك`}
            >
              <i className={`fas ${savedIds.has(book.id) ? 'fa-check' : 'fa-bookmark'} text-[10px]`}></i>
              {savedIds.has(book.id) ? 'تم الحفظ ✅' : `حفظ ${book.id}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;