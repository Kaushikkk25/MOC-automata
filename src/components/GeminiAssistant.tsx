import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { askGemini, GeminiConfigError, ChatTurn } from '../utils/GeminiClient';

interface ChatMessage {
  role: 'user' | 'assistant' | 'error';
  text: string;
}

const SYSTEM_INSTRUCTION = `You are "Kevin AI", a friendly, concise tutor embedded in AutomataStudio, a web app for learning Theory of Computation (DFA, NFA, ε-NFA, Regular Expressions, PDA, Turing Machines, Context-Free Grammars, and the standard conversions between them: Thompson's Construction for Regex-to-NFA, Subset/Powerset Construction for NFA-to-DFA, DFA Minimization via Table-Filling, and DFA-to-Regex via State Elimination). Keep answers clear, brief, and exam-friendly, using small worked examples where helpful. If asked to generate practice questions, state the target language or regex explicitly. If the student's question is ambiguous, ask one clarifying question instead of guessing.

Formatting rules: your response is rendered as Markdown (headers, **bold**, bullet lists, and code spans all work), but there is NO math-typesetting support — never use LaTeX or dollar-sign math delimiters like $q_1$ or \\{q_0, q_1\\}. Instead write state names and sets in plain text, e.g. "q0", "q1", the pair (q1, q0), or the set {q0, q1}. Use subscripts as plain characters (q0, q1) rather than LaTeX subscript syntax.`;

const QUICK_PROMPTS = [
  "Explain Thompson's Construction with a small example",
  'Explain Subset Construction (NFA to DFA) step by step',
  'Explain DFA Minimization (Table-Filling)',
  'Give me a practice regex-to-NFA question with a hint',
];

export const GeminiAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // Build the full turn history Gemini needs for context: everything said
    // so far (skipping local-only error bubbles, which Gemini never actually
    // produced), plus this new user message at the end.
    const history: ChatTurn[] = [
      ...messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role === 'assistant' ? ('model' as const) : ('user' as const), text: m.text })),
      { role: 'user', text: trimmed },
    ];

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await askGemini(history, SYSTEM_INSTRUCTION);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      const message =
        err instanceof GeminiConfigError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Something went wrong talking to Gemini.';
      setMessages((prev) => [...prev, { role: 'error', text: message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        {!isOpen && <span className="text-sm font-bold pr-1">Ask Kevin AI</span>}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-5 z-50 w-[380px] max-w-[92vw] h-[520px] max-h-[75vh] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-indigo-600 text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="font-bold text-sm">Kevin AI — Tutor Assistant</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 px-1">
                  Ask about any Theory of Computation concept, or try:
                </p>
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-auto bg-indigo-600 text-white whitespace-pre-wrap'
                    : m.role === 'error'
                    ? 'bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-1.5 whitespace-pre-wrap'
                    : 'bg-white border border-gray-200 text-slate-800'
                }`}
              >
                {m.role === 'error' && <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
                {m.role === 'assistant' ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      h1: ({ children }) => <p className="font-bold text-sm mb-1.5">{children}</p>,
                      h2: ({ children }) => <p className="font-bold text-sm mb-1.5">{children}</p>,
                      h3: ({ children }) => <p className="font-bold text-xs mb-1">{children}</p>,
                      h4: ({ children }) => <p className="font-bold text-xs mb-1">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5 last:mb-0">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5 last:mb-0">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      code: ({ children }) => (
                        <code className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono">{children}</code>
                      ),
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    }}
                  >
                    {m.text}
                  </ReactMarkdown>
                ) : (
                  <span>{m.text}</span>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-200 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send(input);
              }}
              placeholder="Ask a question…"
              className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => send(input)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};