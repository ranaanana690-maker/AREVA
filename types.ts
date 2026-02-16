
export interface Book {
  id: string;
  title: string;
  list: string;
  lang?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  isError?: boolean;
}

export interface BotConfig {
  tone: string;
  focus: string;
  style: string;
  persona: string;
}

// Task-Oriented Memory: session-scoped entity tracking
export interface SessionState {
  lastEntityId: string | null;
  lastEntityTitle: string | null;
  preferredTopics: string[];
}

// Watchlist: saved books (persisted in LocalStorage)
export interface BookmarkEntry {
  bookId: string;
  title: string;
  list: string;
  savedAt: number;
}

export interface LibraryData {
  botName: string;
  welcomeMessages: string[];
  books: Book[];
  responseTemplates: {
    notFound: string;
    found: string;
    multipleFound: string;
    generalHelp: string;
    closing: string[];
    error: string;
  };
  botBehavior: BotConfig;
}
