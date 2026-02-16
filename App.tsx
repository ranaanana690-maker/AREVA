import React, { useState, useEffect, useRef } from 'react';
import { libraryData } from './data/libraryData';
import { sendMessageToGemini } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import VoiceInterface from './components/VoiceInterface';
import Sidebar from './components/Sidebar';
import { useLive } from './hooks/useLive';
import { Message, SessionState, BookmarkEntry } from './types';
import { v4 as uuidv4 } from 'uuid';
import { addToWatchlist, getWatchlist } from './utils/db';

// Extract book ID pattern (A01, B55, C123, etc.) from text
const extractBookEntity = (text: string): { id: string; title: string } | null => {
  const idMatch = text.match(/\b([ABC]\d{2,3})\b/i);
  if (idMatch) {
    const bookId = idMatch[1].toUpperCase();
    const book = libraryData.books.find(b => b.id === bookId);
    if (book) {
      return { id: book.id, title: book.title };
    }
  }
  return null;
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<BookmarkEntry[]>([]);

  // Task-Oriented Session State (in-memory, resets on new chat)
  const [sessionState, setSessionState] = useState<SessionState>({
    lastEntityId: null,
    lastEntityTitle: null,
    preferredTopics: []
  });

  // Dictation Mode State
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textBeforeDictation = useRef<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveSession = useLive();

  // Load watchlist on mount
  useEffect(() => {
    setWatchlist(getWatchlist());
    if (window.innerWidth >= 768) {
      setIsSidebarOpen(true);
    }
    initNewChat();
  }, []);

  const initNewChat = () => {
    const randomWelcome = libraryData.welcomeMessages[Math.floor(Math.random() * libraryData.welcomeMessages.length)];
    const initialMsg: Message = {
      id: uuidv4(),
      text: randomWelcome,
      sender: 'bot'
    };
    setMessages([initialMsg]);
    setIsLoading(false);
    // Zero-History Start: reset session state
    setSessionState({ lastEntityId: null, lastEntityTitle: null, preferredTopics: [] });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Dictation Logic
  const toggleDictation = () => {
    if (isDictating) stopDictation();
    else startDictation();
  };

  const startDictation = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      alert("عذراً، متصفحك لا يدعم خاصية الإملاء الصوتي. يرجى استخدام متصفح Google Chrome.");
      return;
    }
    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;
    textBeforeDictation.current = inputText;

    recognition.onstart = () => setIsDictating(true);
    recognition.onresult = (event: any) => {
      const fullSessionTranscript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      const separator = textBeforeDictation.current && fullSessionTranscript ? ' ' : '';
      setInputText(textBeforeDictation.current + separator + fullSessionTranscript);
    };
    recognition.onerror = () => setIsDictating(false);
    recognition.onend = () => setIsDictating(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsDictating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    if (isDictating) stopDictation();

    const userMsg: Message = {
      id: uuidv4(),
      text: inputText.trim(),
      sender: 'user'
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const responseText = await sendMessageToGemini(userMsg.text, sessionState);

      const botMsg: Message = {
        id: uuidv4(),
        text: responseText,
        sender: 'bot'
      };
      setMessages(prev => [...prev, botMsg]);

      // Entity extraction: update session state with last mentioned book
      const entity = extractBookEntity(responseText);
      if (entity) {
        setSessionState(prev => ({
          ...prev,
          lastEntityId: entity.id,
          lastEntityTitle: entity.title
        }));
      }
    } catch (error: any) {
      const errorMsg: Message = {
        id: uuidv4(),
        text: error.message || libraryData.responseTemplates.error,
        sender: 'bot',
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  const handleBookmark = (bookId: string, title: string, list: string) => {
    const bookmark: BookmarkEntry = {
      bookId,
      title,
      list,
      savedAt: Date.now()
    };
    const updated = addToWatchlist(bookmark);
    setWatchlist(updated);
    // Auto-open sidebar to show the saved book
    setIsSidebarOpen(true);
  };

  const toggleVoiceMode = () => {
    if (!isVoiceMode) {
      setIsVoiceMode(true);
      liveSession.connect();
    } else {
      liveSession.disconnect();
      setIsVoiceMode(false);
    }
  };

  return (
    <>
      <div className="flex w-full h-full relative overflow-hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          watchlist={watchlist}
          setWatchlist={setWatchlist}
        />

        <div className="flex-1 flex flex-col h-full relative transition-all duration-300">
          <div className="bg-[#28a745] text-white p-4 text-center text-xl font-bold rounded-none md:rounded-tr-[15px] shadow-sm flex-shrink-0 relative flex items-center justify-center">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <i className="fas fa-bars"></i>
            </button>

            <h1 className="mx-auto">{libraryData.botName}</h1>

            <button
              onClick={toggleVoiceMode}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all"
              title="محادثة صوتية مباشرة"
            >
              <i className="fas fa-headset"></i>
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden relative bg-[#f9f9f9]">
            {isVoiceMode && (
              <VoiceInterface live={liveSession} onClose={toggleVoiceMode} />
            )}

            <div className="flex-1 overflow-y-auto p-5 bg-[#f9f9f9] flex flex-col gap-4 custom-scrollbar">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} onBookmark={handleBookmark} />
              ))}
              {isLoading && (
                <div className="w-fit max-w-[80px] p-2.5 rounded-[18px] bg-[#e6f7eb] self-start mr-auto opacity-90 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 bg-[#28a745] rounded-full typing-dot" style={{ animationDelay: '0s' }}></span>
                  <span className="w-2 h-2 bg-[#28a745] rounded-full typing-dot" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-[#28a745] rounded-full typing-dot" style={{ animationDelay: '0.4s' }}></span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-[#d0d0d0] flex gap-2.5 items-center flex-shrink-0 relative">
              <button
                onClick={toggleDictation}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isDictating
                  ? 'bg-red-100 text-red-600 animate-pulse ring-2 ring-red-400'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                title={isDictating ? "إيقاف الإملاء" : "تحدث للكتابة (إملاء)"}
              >
                <i className={`fas ${isDictating ? 'fa-stop' : 'fa-microphone'} text-sm`}></i>
              </button>

              <div className="flex-grow relative">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isDictating ? "جارٍ الاستماع..." : "ابحث عن كتاب بالرقم أو العنوان..."}
                  className={`w-full p-3 border rounded-full text-[#333] text-base outline-none transition-all duration-300 focus:ring-2
                    ${isDictating ? 'border-red-400 focus:ring-red-200 bg-red-50' : 'border-[#d0d0d0] bg-white focus:border-[#28a745] focus:ring-[#28a745]/20'}
                  `}
                  aria-label="اكتب استفسارك هنا"
                />
                {inputText && (
                  <button
                    onClick={() => { setInputText(''); if (isDictating) stopDictation(); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <i className="fas fa-times-circle"></i>
                  </button>
                )}
              </div>

              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputText.trim()}
                className="bg-[#28a745] hover:bg-[#218838] disabled:bg-gray-400 disabled:cursor-not-allowed text-white border-none w-11 h-11 rounded-full cursor-pointer flex items-center justify-center transition-all duration-300 active:scale-95 flex-shrink-0 shadow-sm"
                aria-label="إرسال"
              >
                <i className="fas fa-paper-plane text-lg -ml-[2px]"></i>
              </button>
            </div>
          </div>

          <div className="text-[#333] text-center text-xs opacity-60 p-2 bg-[#f9f9f9] rounded-none flex-shrink-0 border-t border-gray-200">
            <i className="fas fa-book-open ml-1 align-middle"></i> مكتبة الاقامة الجامعية شنتوف محمد - نسخة تجريبية
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
