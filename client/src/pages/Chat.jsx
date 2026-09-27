import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { fetchGithubRepositories } from '../services/githubService';
import { fetchKnowledgeStatus, indexRepositoryKnowledge } from '../services/knowledgeService';

const CHAT_MODES = [
  { id: 'codebase', label: 'Codebase RAG', icon: '🧠', desc: 'AST chunk retrieval with line-level evidence citations' },
  { id: 'architecture', label: 'Architecture', icon: '🏛️', desc: 'Dependency graph relationships & module boundaries' },
  { id: 'security', label: 'Security', icon: '🛡️', desc: 'Auth flaws, injection vectors, and secret scanning' },
  { id: 'debugging', label: 'Debugging', icon: '🐛', desc: 'Error handling, race conditions, and call trace analysis' },
  { id: 'general', label: 'General AI', icon: '🌐', desc: 'Broad software engineering & design advice' },
];

const STARTER_PROMPTS = {
  codebase: [
    'How does authentication and session state work?',
    'Which files implement database schema and migrations?',
    'Where is the Gemini API integration configured?',
    'How are HTTP errors normalized and returned to clients?',
  ],
  architecture: [
    'Explain the overall architecture and dependency flow',
    'Are there any circular dependencies between modules?',
    'Which modules act as central dependency bottlenecks?',
    'Explain how routes connect to controllers and services',
  ],
  security: [
    'Scan for potential authorization bypasses and missing RBAC',
    'Are CORS and cookie policies configured securely?',
    'Identify all endpoints handling user credentials or tokens',
    'Check for unsafe input handling or injection risks',
  ],
  debugging: [
    'Identify unhandled Promise rejections and async edge cases',
    'Where are potential null/undefined dereference risks?',
    'Explain error handling patterns across controllers',
    'Check for race conditions in concurrent request handling',
  ],
  general: [
    'Recommend testing strategies for React + Express architectures',
    'Best practices for securing Node.js REST APIs in production',
    'How to design scalable microservices from this monolith',
    'Explain caching strategies for database query optimization',
  ],
};

export default function Chat() {
  const { repositoryId: urlRepoId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [connectedRepos, setConnectedRepos] = useState([]);
  const [activeRepoId, setActiveRepoId] = useState(urlRepoId || '');
  const [activeMode, setActiveMode] = useState('codebase');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeStatus, setKnowledgeStatus] = useState(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [expandedEvidenceIdx, setExpandedEvidenceIdx] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const initialSentRef = useRef(false);

  // Fetch connected repos if no repo ID is in params
  useEffect(() => {
    if (!urlRepoId) {
      fetchGithubRepositories()
        .then((data) => {
          const connected = (data || []).filter((r) => r.connected);
          setConnectedRepos(connected);
          if (connected.length > 0 && !activeRepoId) {
            setActiveRepoId(connected[0].repositoryId || connected[0]._id);
          }
        })
        .catch(() => {});
    } else {
      setActiveRepoId(urlRepoId);
    }
  }, [urlRepoId, activeRepoId]);

  // Load knowledge base status when activeRepoId changes
  useEffect(() => {
    if (activeRepoId) {
      fetchKnowledgeStatus(activeRepoId)
        .then((status) => setKnowledgeStatus(status))
        .catch(() => setKnowledgeStatus(null));
    }
  }, [activeRepoId]);

  const handleIndexKnowledge = async () => {
    if (!activeRepoId || isIndexing) return;
    setIsIndexing(true);
    try {
      await indexRepositoryKnowledge(activeRepoId);
      const status = await fetchKnowledgeStatus(activeRepoId);
      setKnowledgeStatus(status);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to index knowledge base:', err);
    } finally {
      setIsIndexing(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendQuery = async (userMsg) => {
    const text = userMsg.trim();
    const targetRepo = activeRepoId || urlRepoId;
    if (!text || !targetRepo || isLoading) return;

    setInput('');
    const currentHistory = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: text, mode: activeMode }]);
    setIsLoading(true);

    try {
      const { data } = await api.post(`/chat/${targetRepo}`, {
        message: text,
        mode: activeMode,
        history: currentHistory,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: data.data.reply,
          evidence: data.data.evidence || [],
          mode: data.data.mode || activeMode,
        },
      ]);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to get response from Gemini.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: `⚠️ **Error communicating with Gemini**: ${msg}\n\nPlease verify your network connection or try asking again.`,
          evidence: [],
          mode: activeMode,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  useEffect(() => {
    const initialQuery = location.state?.initialMessage || searchParams.get('q');
    if (initialQuery && !initialSentRef.current && activeRepoId) {
      initialSentRef.current = true;
      sendQuery(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, searchParams, activeRepoId]);

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

  const renderMessageContent = (msg, msgIdx) => {
    if (msg.role === 'user') {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-mist-400">
            <span>Mode: {msg.mode?.toUpperCase() || 'CODEBASE'}</span>
          </div>
          <p className="whitespace-pre-wrap text-xs sm:text-sm font-sans text-mist-100 leading-relaxed">
            {msg.content}
          </p>
        </div>
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
        {/* Evidence Citations Badge */}
        {msg.evidence && msg.evidence.length > 0 && (
          <div className="mb-2 rounded-xl border border-graphite-750 bg-graphite-900/90 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-amber-400">
                <span>📎</span>
                <span>{msg.evidence.length} Codebase Evidence Citations</span>
              </span>
              <button
                onClick={() =>
                  setExpandedEvidenceIdx(expandedEvidenceIdx === msgIdx ? null : msgIdx)
                }
                className="text-[10px] font-mono text-mist-400 hover:text-mist-200 transition-colors"
              >
                {expandedEvidenceIdx === msgIdx ? 'Hide Evidence ▲' : 'View Evidence ▼'}
              </button>
            </div>

            {expandedEvidenceIdx === msgIdx && (
              <div className="mt-2.5 space-y-1.5 pt-2 border-t border-graphite-800">
                {msg.evidence.map((ev, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg bg-graphite-850 px-2.5 py-1.5 text-[11px] font-mono text-mist-300"
                  >
                    <span className="font-semibold text-mist-100">
                      {ev.filePath}:{ev.startLine}-{ev.endLine}
                    </span>
                    {ev.symbolName && (
                      <span className="rounded bg-graphite-800 px-1.5 py-0.5 text-[10px] text-amber-400">
                        {ev.chunkType}: {ev.symbolName}
                      </span>
                    )}
                    {ev.relevanceScore !== undefined && (
                      <span className="text-[10px] text-mist-500">
                        match: {Math.round(ev.relevanceScore * 100)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <MarkdownRenderer content={mainContent} />

        {followUps.length > 0 && (
          <div className="mt-4 pt-3 border-t border-graphite-750">
            <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-mist-400 mb-2">
              Suggested Follow-ups
            </p>
            <div className="flex flex-wrap gap-2">
              {followUps.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => sendQuery(question)}
                  className="rounded-lg border border-graphite-700 bg-graphite-800/80 px-3 py-1.5 text-xs text-mist-300 hover:border-amber-400/40 hover:bg-graphite-700 hover:text-mist-100 transition-colors text-left font-mono"
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
    <div className="flex h-[calc(100vh-6.5rem)] flex-col space-y-3 pb-2">
      {/* Top Bar with Mode Selector and Index Status */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shrink-0 border-b border-graphite-800 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-mist-100">
                Repository AI Intelligence
              </h1>
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-mono text-purple-300">
                RAG + Gemini 2.5
              </span>
            </div>
            <p className="text-xs text-mist-400 mt-0.5">
              Evidence-grounded code intelligence across AST chunks, architecture graph, and security vectors.
            </p>
          </div>

          {connectedRepos.length > 1 && !urlRepoId && (
            <select
              value={activeRepoId}
              onChange={(e) => {
                setActiveRepoId(e.target.value);
                setMessages([]);
              }}
              className="rounded-lg border border-graphite-750 bg-graphite-850 px-2.5 py-1 text-xs font-mono text-mist-200 outline-none focus:border-amber-400"
            >
              {connectedRepos.map((r) => (
                <option key={r.repositoryId || r.githubId} value={r.repositoryId || r._id}>
                  {r.fullName || r.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Knowledge Base Status & Action */}
        <div className="flex flex-wrap items-center gap-2">
          {knowledgeStatus && (
            <div className="flex items-center gap-1.5 rounded-lg border border-graphite-750 bg-graphite-850 px-2.5 py-1 text-[11px] font-mono text-mist-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  knowledgeStatus.status === 'indexed'
                    ? 'bg-emerald-400'
                    : knowledgeStatus.status === 'indexing'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-mist-500'
                }`}
              />
              <span>
                {knowledgeStatus.status === 'indexed'
                  ? `RAG: ${knowledgeStatus.chunkCount} chunks`
                  : knowledgeStatus.status === 'indexing'
                  ? 'RAG Indexing...'
                  : 'RAG: Not Indexed'}
              </span>
            </div>
          )}

          <button
            onClick={handleIndexKnowledge}
            disabled={isIndexing || !activeRepoId}
            className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-50 flex items-center gap-1.5 font-mono"
          >
            <span>{isIndexing ? '⏳ Indexing...' : '⚡ Re-index RAG'}</span>
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="rounded-lg border border-graphite-750 bg-graphite-800 px-3 py-1 text-xs font-semibold text-mist-400 hover:bg-graphite-750 hover:text-mist-100 transition-colors"
            >
              Clear
            </button>
          )}

          <Link
            to="/dashboard/repositories"
            className="text-xs font-mono text-mist-400 hover:text-amber-400 transition-colors flex items-center gap-1 ml-1"
          >
            <span>← Repositories</span>
          </Link>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 border-b border-graphite-800/60">
        <span className="text-[11px] font-mono uppercase text-mist-500 mr-1 shrink-0">Mode:</span>
        {CHAT_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setActiveMode(mode.id)}
            title={mode.desc}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
              activeMode === mode.id
                ? 'bg-amber-400/15 border border-amber-400/50 text-amber-300 shadow-sm'
                : 'bg-graphite-850/80 border border-graphite-750 text-mist-400 hover:text-mist-200 hover:bg-graphite-800'
            }`}
          >
            <span>{mode.icon}</span>
            <span>{mode.label}</span>
          </button>
        ))}
      </div>

      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-graphite-750 bg-graphite-900/80 p-4 sm:p-6 shadow-panel">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-purple-500/20 border border-amber-400/30 text-amber-400 shadow-glow-sm">
              <span className="text-2xl">
                {CHAT_MODES.find((m) => m.id === activeMode)?.icon || '🧠'}
              </span>
            </div>

            <div className="max-w-md space-y-1">
              <h2 className="text-base font-semibold text-mist-100">
                {CHAT_MODES.find((m) => m.id === activeMode)?.label} Intelligence
              </h2>
              <p className="text-xs sm:text-sm text-mist-400 leading-relaxed">
                {CHAT_MODES.find((m) => m.id === activeMode)?.desc}
              </p>
            </div>

            {/* Starter chips for current mode */}
            <div className="w-full max-w-lg space-y-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-mist-400">
                Suggested {activeMode.toUpperCase()} Inquiries
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(STARTER_PROMPTS[activeMode] || STARTER_PROMPTS.codebase).map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendQuery(prompt)}
                    className="flex items-center justify-between rounded-xl border border-graphite-750 bg-graphite-850/90 p-3 text-left text-xs text-mist-300 transition-all hover:border-amber-400/40 hover:bg-graphite-800 hover:text-mist-100 group"
                  >
                    <span>{prompt}</span>
                    <span className="text-mist-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2 font-mono">
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
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/20 to-purple-500/20 border border-amber-400/30 text-xs font-mono font-bold text-amber-400 shadow-sm">
                    AI
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-graphite-800 border border-amber-400/30 text-mist-100 rounded-tr-sm'
                      : 'bg-graphite-850/90 border border-graphite-750 text-mist-100 rounded-tl-sm'
                  }`}
                >
                  {renderMessageContent(msg, i)}
                </div>

                {msg.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-graphite-800 border border-graphite-700 text-xs font-mono font-bold text-mist-300 shadow-sm">
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
                <div className="rounded-2xl rounded-tl-sm border border-graphite-750 bg-graphite-850/90 p-4 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse delay-100" />
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse delay-200" />
                  <span className="ml-2 text-xs font-mono text-mist-400">
                    Retrieving RAG chunks & reasoning with Gemini…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="shrink-0 flex gap-2 pt-1">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`[${activeMode.toUpperCase()}] Ask a question with evidence grounding… (Enter to send)`}
            disabled={isLoading || (!activeRepoId && !urlRepoId)}
            className="w-full rounded-xl border border-graphite-750 bg-graphite-900 px-4 py-3 text-xs sm:text-sm text-mist-100 outline-none transition-all placeholder:text-mist-500 focus:border-amber-400 focus:bg-graphite-850 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !input.trim() || (!activeRepoId && !urlRepoId)}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-xs sm:text-sm font-semibold text-graphite-950 transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm active:scale-95 shrink-0"
        >
          <span>Send</span>
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
