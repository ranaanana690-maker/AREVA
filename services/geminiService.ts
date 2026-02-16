import { libraryData } from "../data/libraryData";
import { SessionState } from "../types";

// Google Gemini API Keys - Round Robin Rotation
const API_KEYS: string[] = [
  process.env.GOOGLE_KEY_1 || '',
  process.env.GOOGLE_KEY_2 || '',
  process.env.GOOGLE_KEY_3 || '',
  process.env.GOOGLE_KEY_4 || '',
].filter(k => k.length > 0);

const GOOGLE_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Current key index - persists across requests
let currentKeyIndex = 0;

const rotateKey = (): void => {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
};

/**
 * Zero-History Prompt: Only injects the last entity + preferred topics.
 */
const createSystemPrompt = (session: SessionState): string => {
  const bookDataJson = JSON.stringify(libraryData.books, null, 2);
  const { tone, focus, persona } = libraryData.botBehavior;

  let entityContext = "";
  if (session.lastEntityId && session.lastEntityTitle) {
    entityContext = `آخر كتاب تم ذكره في هذه الجلسة: ID="${session.lastEntityId}", العنوان="${session.lastEntityTitle}". إذا استخدم المستخدم ضمائر (هو، منه، الجزء الثاني، أريده) فهي تشير لهذا الكتاب.`;
  }

  let prefsContext = "";
  if (session.preferredTopics.length > 0) {
    prefsContext = `اهتمامات المستخدم السابقة: ${session.preferredTopics.join("، ")}.`;
  }

  return `أنت ${persona}.
شخصيتك: ${tone}.
مهمتك: ${focus}

${entityContext}
${prefsContext}

البيانات المتاحة لك (قائمة الكتب بصيغة JSON):
\`\`\`json
${bookDataJson}
\`\`\`
الحقول: 'id', 'title', 'list'.

قواعد الرد المختصر:
1. ابحث بال ID (مثل A01) → تطابق تام. أو بالعنوان → كلمات مفتاحية.
2. الرد يجب أن يكون مختصراً جداً:
   - إذا وُجد: **✅ متوفر** | 📖 العنوان | 🔖 الرقم: {id} | 📂 الرف: {list}
   - إذا تعدد: قائمة مختصرة (أقصى 5 نتائج).
   - إذا لم يوجد: "❌ غير متوفر. جرّب كلمات أخرى."
   - إذا سأل سؤالاً عاماً أو طلب مساعدة: أجب بإيجاز.
3. لغة الرد: عربية فصحى مختصرة.
4. لا تكرر التعليمات أو تشرح نفسك. أجب مباشرة.`;
};

/**
 * Call Google Gemini API with automatic key rotation on quota errors.
 */
export const sendMessageToGemini = async (
  currentMessage: string,
  session: SessionState
): Promise<string> => {
  if (API_KEYS.length === 0) {
    throw new Error("عذراً، الخدمة غير متوفرة حالياً. يرجى المحاولة لاحقاً.");
  }

  const systemPrompt = createSystemPrompt(session);
  let lastError = '';

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const key = API_KEYS[currentKeyIndex];

    try {
      // Google API expects key as query param
      const url = `${GOOGLE_API_URL}?key=${key}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: systemPrompt + "\n\nالمستخدم: " + currentMessage }]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 20,
            topP: 0.9,
            maxOutputTokens: 512,
          }
        })
      });

      // If rate limited (429) or quota exceeded (402/403) → rotate
      if (response.status === 429 || response.status === 402 || response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        lastError = errorData?.error?.message || `HTTP ${response.status}`;
        console.warn(`🔄 Key ${currentKeyIndex + 1} quota/rate limit, rotating...`, lastError);
        rotateKey();
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Gemini API Error:", errorData);
        throw new Error("server_error");
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (content) {
        return content;
      } else {
        throw new Error("empty_response");
      }

    } catch (error: any) {
      // Network errors or non-quota API errors
      if (attempt < API_KEYS.length - 1 && error.message !== 'empty_response' && error.message !== 'server_error') {
        console.warn(`🔄 Key ${currentKeyIndex + 1} failed (${error.message}), trying next...`);
        rotateKey();
        lastError = error.message;
        continue;
      }
      console.error("Gemini API Error:", error);
      throw new Error("عذراً، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى.");
    }
  }

  // All keys exhausted
  throw new Error("عذراً، الخدمة مشغولة حالياً. يرجى المحاولة بعد قليل.");
};
