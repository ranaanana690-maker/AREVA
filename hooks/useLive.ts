import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { libraryData } from '../data/libraryData';
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';

// Google Gemini API Keys - Round Robin
const API_KEYS: string[] = [
  process.env.GOOGLE_KEY_1 || '',
  process.env.GOOGLE_KEY_2 || '',
  process.env.GOOGLE_KEY_3 || '',
  process.env.GOOGLE_KEY_4 || '',
].filter(k => k.length > 0);

// Exact model from audio-orb
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';

const createSystemInstruction = (): string => {
  const bookDataJson = JSON.stringify(libraryData.books, null, 2);
  const { tone, focus, persona } = libraryData.botBehavior;

  return `
أنت ${persona}.
شخصيتك: ${tone}.
مهمتك: ${focus}

أنت مساعد صوتي الآن. اجعل ردودك مختصرة وطبيعية للكلام.

البيانات المتاحة لك (كتب بصيغة JSON):
${bookDataJson}

الحقول: 'id', 'title', 'list'.

القواعد:
1. إذا بحث بـ ID (مثل A05) أو عنوان → ابحث في القائمة.
2. إذا وُجد: اقرأ العنوان والرقم والرف بوضوح.
3. إذا تعدد: اذكر أول 2-3 نتائج.
4. إذا لم يوجد: اقترح المحاولة مرة أخرى.
5. تحدث بالعربية الواضحة المختصرة.
`;
};

export interface UseLiveReturn {
  isConnected: boolean;
  isListening: boolean;
  volume: number;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
}

export const useLive = (): UseLiveReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs for state access in closures
  const isListeningRef = useRef(false);

  // Separate Contexts as in audio-orb reference
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);

  const sessionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null); // To manage volume if needed, or just connection point

  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Helper to ensure contexts exist (lazy init)
  const ensureContexts = () => {
    if (!inputAudioContextRef.current) {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      // Create a gain node as in reference, though strictly optional if we connect direct to destination
      outputNodeRef.current = outputAudioContextRef.current.createGain();
      outputNodeRef.current.connect(outputAudioContextRef.current.destination);
    }
  };

  const stopAudio = useCallback(() => {
    isListeningRef.current = false;
    // 1. Stop processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    // 2. Stop input source
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }
    // 3. Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    // 4. Stop playing sources
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { }
    });
    audioSourcesRef.current.clear();

    setIsListening(false);
    setVolume(0);
  }, []);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) { }
      sessionRef.current = null;
    }
    stopAudio();
    setIsConnected(false);

    // Close contexts on full disconnect to cleanup
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
  }, [stopAudio]);

  const connect = useCallback(async () => {
    setError(null);
    if (API_KEYS.length === 0) {
      setError("لا توجد مفاتيح API متوفرة");
      return;
    }

    try {
      ensureContexts();
      const inputCtx = inputAudioContextRef.current!;
      const outputCtx = outputAudioContextRef.current!;

      // Resume contexts (User Interaction)
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      // Initialize nextStartTime
      nextStartTimeRef.current = outputCtx.currentTime;

      // 1. Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 2. Setup Input Processing (16kHz context)
      // "audio-orb": createMediaStreamSource -> scriptProcessor -> destination
      inputSourceRef.current = inputCtx.createMediaStreamSource(stream);
      processorRef.current = inputCtx.createScriptProcessor(4096, 1, 1);

      inputSourceRef.current.connect(processorRef.current);
      processorRef.current.connect(inputCtx.destination);

      // 3. Connect to Gemini Live with Rotation
      const systemInstructionText = createSystemInstruction();

      let connected = false;
      let lastError = null;
      let keyIndex = Math.floor(Math.random() * API_KEYS.length);

      for (let i = 0; i < API_KEYS.length; i++) {
        const apiKey = API_KEYS[keyIndex];
        keyIndex = (keyIndex + 1) % API_KEYS.length;

        try {
          console.log(`Trying key index ${keyIndex} (Key ending in ...${apiKey.slice(-4)})...`);
          const client = new GoogleGenAI({ apiKey });

          const session = await client.live.connect({
            model: MODEL_NAME,
            config: {
              responseModalities: [Modality.AUDIO],
              systemInstruction: { parts: [{ text: systemInstructionText }] },
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Orus' } }
              },
            },
            callbacks: {
              onopen: () => {
                console.log("Connected to Gemini Live!");
                setIsConnected(true);
                isListeningRef.current = true;
                setIsListening(true);
              },
              onmessage: async (message: LiveServerMessage) => {
                // Handle Audio Output
                const audioPart = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
                if (audioPart && outputAudioContextRef.current) {
                  const outCtx = outputAudioContextRef.current;
                  const audioBuffer = await decodeAudioData(
                    decode(audioPart.data),
                    outCtx,
                    24000,
                    1
                  );
                  nextStartTimeRef.current = Math.max(
                    nextStartTimeRef.current,
                    outCtx.currentTime
                  );
                  const source = outCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputNodeRef.current!);

                  source.addEventListener('ended', () => {
                    audioSourcesRef.current.delete(source);
                  });

                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  audioSourcesRef.current.add(source);
                }

                // Handle Interruption
                if (message.serverContent?.interrupted) {
                  audioSourcesRef.current.forEach(src => {
                    try { src.stop(); } catch (e) { }
                  });
                  audioSourcesRef.current.clear();
                  if (outputAudioContextRef.current) nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
                }
              },
              onclose: () => {
                console.log("Session closed");
                disconnect();
              },
              onerror: (err: any) => {
                console.error("Live API Error:", err);
                setError(`خطأ: ${err.message || "انقطع الاتصال"}`);
                disconnect();
              }
            }
          });

          sessionRef.current = session;
          connected = true;
          break; // Success!
        } catch (err) {
          console.warn(`Key attempt failed: ${err.message}`);
          lastError = err;
          // Continue to next key
        }
      } // end for loop

      if (!connected) {
        throw lastError || new Error("فشل الاتصال بجميع المفاتيح");
      }

      // 4. Start sending input data (now that session is ready)
      processorRef.current.onaudioprocess = (e) => {
        const inputBuffer = e.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);

        // Volume visualization logic
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        setVolume(Math.sqrt(sum / inputData.length));

        // Send to session using createBlob
        if (sessionRef.current && isListeningRef.current) {
          try {
            sessionRef.current.sendRealtimeInput({
              media: createBlob(inputData)
            });
          } catch (err) { }
        }
      };

    } catch (err: any) {
      console.error("Failed to connect", err);
      setError(`فشل الاتصال: ${err.message}`);
      disconnect();
    }
  }, [disconnect]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { isConnected, isListening, volume, connect, disconnect, error };
};
