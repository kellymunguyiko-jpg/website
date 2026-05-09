import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Waves, Volume2, X } from 'lucide-react';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

interface VoiceAIProps {
  onDashboard: () => void;
  onLogin: () => void;
  onNavigate: (section: string) => void;
  onCreateSite: () => void;
  onPlans: () => void;
  isLoggedIn: boolean;
}

const welcomeText = 'Hey, how can I help you today? This is clone of KellySeekAI.';
const apiKey = import.meta.env.VITE_COHERE_API_KEY;

export default function VoiceAI({ onDashboard, onLogin, onNavigate, onCreateSite, onPlans, isLoggedIn }: VoiceAIProps) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [lastHeard, setLastHeard] = useState('');
  const [reply, setReply] = useState('Tap the microphone and speak. Try: I need dashboard.');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const welcomedRef = useRef(false);

  const speak = (text: string) => {
    setReply(text);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const askCohere = async (prompt: string) => {
    setThinking(true);
    try {
      const response = await fetch('https://api.cohere.ai/v2/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${COHERE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'command-a-03-2025',
          messages: [
            {
              role: 'system',
              content: 'You are KellySeekAI voice assistant for WebCraft. Answer clearly in 1-3 short sentences. If user asks about navigation, mention they can say dashboard, login, create site, plans, projects, contact, or home.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
      const data = await response.json();
      const answer = data.message?.content?.[0]?.text || 'I can help with websites, dashboard, plans, projects, and account questions.';
      speak(answer.slice(0, 450));
    } catch {
      speak('I could not connect to KellySeekAI right now. Please try again.');
    } finally {
      setThinking(false);
    }
  };

  const handleCommand = (raw: string) => {
    const text = raw.toLowerCase();
    setLastHeard(raw);

    if (text.includes('dashboard') || text.includes('dashbord')) {
      if (isLoggedIn) {
        speak('Opening your dashboard now.');
        onDashboard();
      } else {
        speak('Dashboard needs login first. I am opening the login page for you.');
        onLogin();
      }
      return;
    }

    if (
      text.includes('login') ||
      text.includes('log in') ||
      text.includes('sign in') ||
      text.includes('signup') ||
      text.includes('sign up') ||
      text.includes('register') ||
      text.includes('create account') ||
      text.includes('open account')
    ) {
      speak('Opening login and sign up page.');
      onLogin();
      return;
    }

    if (text.includes('create') || text.includes('new site') || text.includes('build website')) {
      if (isLoggedIn) {
        speak('Opening create site form.');
        onCreateSite();
      } else {
        speak('Please login first, then I can help you create a new site.');
        onLogin();
      }
      return;
    }

    if (text.includes('price') || text.includes('plan') || text.includes('premium') || text.includes('vip')) {
      speak('Opening plans and pricing.');
      onPlans();
      return;
    }

    if (text.includes('project')) {
      speak('Opening projects section.');
      onNavigate('projects');
      return;
    }

    if (text.includes('contact')) {
      speak('Opening contact section.');
      onNavigate('contact');
      return;
    }

    if (text.includes('home')) {
      speak('Going home.');
      onNavigate('home');
      return;
    }

    askCohere(raw);
  };

  const startListening = () => {
    setOpen(true);
    if (!welcomedRef.current) {
      welcomedRef.current = true;
      speak(welcomeText);
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      speak('Voice is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleCommand(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      speak('I could not hear clearly. Please try again.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="fixed bottom-24 right-6 z-50">
      {open && (
        <div className="mb-3 w-[320px] max-w-[calc(100vw-48px)] overflow-hidden rounded-3xl border border-white/10 bg-black/45 p-4 text-white shadow-2xl shadow-green-500/10 backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                <Volume2 size={16} />
              </div>
              <div>
                <p className="text-sm font-bold">KellySeekAI Voice</p>
                <p className="text-[10px] text-green-400">Voice navigation assistant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white">
              <X size={14} />
            </button>
          </div>

          <div className="mb-3 rounded-2xl bg-white/[0.04] p-3">
            <p className="text-xs text-gray-400">AI says</p>
            <p className="mt-1 text-sm text-gray-100">{thinking ? 'KellySeekAI is thinking...' : reply}</p>
          </div>

          {lastHeard && (
            <div className="rounded-2xl bg-green-500/10 p-3">
              <p className="text-xs text-green-400">You said</p>
              <p className="mt-1 text-sm text-green-100">{lastHeard}</p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={listening ? stopListening : startListening}
        className={`group flex h-16 items-center gap-3 rounded-[28px] border px-5 shadow-2xl backdrop-blur-2xl transition-all hover:scale-105 ${
          listening ? 'border-green-400/50 bg-green-500/20 shadow-green-500/30' : 'border-white/10 bg-black/45 shadow-green-500/10'
        }`}
        aria-label="KellySeekAI voice assistant"
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${listening ? 'bg-green-500 text-white' : 'bg-white/10 text-green-300'}`}>
          {listening ? <MicOff size={20} /> : <Mic size={20} />}
        </div>
        <div className="flex items-center gap-1 text-cyan-100">
          {[18, 30, 22, 36, 26, 42, 30, 24, 34, 20].map((h, i) => (
            <span
              key={i}
              className={`w-1.5 rounded-full bg-cyan-100 transition-all ${listening ? 'animate-pulse' : ''}`}
              style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <Waves size={18} className="text-green-300 opacity-70" />
      </button>
    </div>
  );
}