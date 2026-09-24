import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';

const STARTER_PROMPTS = [
  'Explain the overall architecture and folder structure',
  'Scan for potential security flaws and sanitize queries',
  'How does user authentication and token issuance work?',
  'Recommend unit and integration test strategies',
];

export default function Chat() {
  const { repositoryId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendQuery = async (userMsg) => {
    const text = userMsg.trim();
    if (!text || isLoading) return;

    setInput('');
    const currentHistory = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      const { data } = await api.post(`/chat/${repositoryId}`, {
        message: text,
        history: currentHistory,
      });
      setMessages((prev) => [...prev, { role: 'model', content: data.data.reply }]);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to get response from Gemini.';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: `⚠️ **Error communicating with Gemini**: ${msg}\n\nPlease verify your network or try asking again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuery(input);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery(input);
    }
  };

  const renderMessageContent = (msg) => {
    if (msg.role === 'user') {
      return (
        <p className="whitespace-pre-wrap text-xs sm:text-sm font-sans text-mist-100 leading-relaxed">
          {msg.content}
        </p>
      );
    }

    // Check for suggested follow-ups
    const parts = msg.content.split('### Suggested Follow-ups');
    const mainContent = parts[0];

    let followUps = [];
    if (parts.length > 1) {
      const listMatches = parts[1].match(/[-*] (.*)/g);
      if (listMatches) {
        followUps = listMatches.map((m) => m.replace(/^[-*]\s*/, '').trim());
      }
    }

    return (
      <div className="w-full space-y-3">
        <MarkdownRenderer content={mainContent} />
        {followUps.length > 0 && (
          <div className="mt-4 pt-3 border-t border-graphite-700/80">
            <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-mist-500 mb-2">
              Suggested Follow-ups
            </p>
            <div className="flex flex-wrap gap-2">
              {followUps.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => sendQuery(question)}
                  className="rounded-lg border border-graphite-700 bg-graphite-800/80 px-3 py-1.5 text-xs text-mist-300 hover:border-amber-400/40 hover:bg-graphite-700 hover:text-mist-100 transition-colors text-left"
                >
                  {question} →
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col space-y-3">
      {/* Top Bar */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-mist-100">
              Codebase AI Chat
            </h1>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono text-purple-300">
              Gemini 2.5 Flash
            </span>
          </div>
          <p className="text-xs text-mist-400">
            Ask questions about repository structure, algorithms, security posture, and dependencies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="rounded-lg border border-graphite-700 bg-graphite-800 px-3 py-1.5 text-xs font-medium text-mist-400 hover:bg-graphite-700 hover:text-mist-100 transition-colors"
            >
              Clear Chat
            </button>
          )}
          <Link
            to="/dashboard/repositories"
            className="text-xs font-mono text-mist-400 hover:text-amber-400 transition-colors"
          >
            ← Repositories
          </Link>
        </div>
      </div>

      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-graphite-700 bg-graphite-900/80 p-4 sm:p-6 shadow-panel">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-purple-500/20 border border-amber-400/30 text-2xl shadow-glow-sm">
              💬
            </div>

            <div className="max-w-md space-y-1">
              <h2 className="text-base font-semibold text-mist-100">
                Explore this repository with AI
              </h2>
              <p className="text-xs sm:text-sm text-mist-400 leading-relaxed">
                Gemini reads repository code directly to answer architectural questions, review logic, and trace bugs.
              </p>
            </div>

            {/* Starter chips */}
            <div className="w-full max-w-lg space-y-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-mist-500">
                Recommended Queries
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendQuery(prompt)}
                    className="flex items-center justify-between rounded-xl border border-graphite-700 bg-graphite-850 p-3 text-left text-xs text-mist-300 transition-all hover:border-amber-400/40 hover:bg-graphite-800 hover:text-mist-100 group"
                  >
                    <span>{prompt}</span>
                    <span className="text-mist-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 animate-fade-in ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role !== 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/20 to-purple-500/20 border border-amber-400/30 text-xs font-mono font-bold text-amber-400">
                    AI
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-graphite-800 border border-amber-400/30 text-mist-100 rounded-tr-sm'
                      : 'bg-graphite-850/90 border border-graphite-700/80 text-mist-100 rounded-tl-sm'
                  }`}
                >
                  {renderMessageContent(msg)}
                </div>

                {msg.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-graphite-800 border border-graphite-700 text-xs font-mono font-bold text-mist-300">
                    You
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start animate-fade-in">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/20 to-purple-500/20 border border-amber-400/30 text-xs font-mono font-bold text-amber-400">
                  AI
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-graphite-700/80 bg-graphite-850/90 p-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse delay-100" />
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse delay-200" />
                  <span className="ml-2 text-xs font-mono text-mist-400">
                    Gemini is parsing repository context…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="shrink-0 flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about code structure, bug fixes, or logic… (Enter to send)"
            disabled={isLoading}
            className="w-full rounded-xl border border-graphite-700 bg-graphite-900 px-4 py-3 text-xs sm:text-sm text-mist-100 outline-none transition-all placeholder:text-mist-500 focus:border-amber-400 focus:bg-graphite-850 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-3 text-xs sm:text-sm font-semibold text-graphite-950 transition-all hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm active:scale-95"
        >
          <span>Send</span>
          <span className="font-mono">→</span>
        </button>
      </form>
    </div>
  );
}
