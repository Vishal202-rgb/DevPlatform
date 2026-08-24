import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function Chat() {
  const { repositoryId } = useParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendQuery = async (userMsg) => {
    if (!userMsg.trim() || isLoading) return;
    
    setInput('');
    const currentHistory = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const { data } = await api.post(`/chat/${repositoryId}`, {
        message: userMsg,
        history: currentHistory
      });
      setMessages(prev => [...prev, { role: 'model', content: data.data.reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', content: 'Error: ' + (err.response?.data?.message || err.message) }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendQuery(input);
  };

  const renderMessageContent = (msg) => {
    if (msg.role === 'user') {
      return msg.content;
    }
    
    // Check for suggested follow-ups
    const parts = msg.content.split('### Suggested Follow-ups');
    const mainContent = parts[0];
    
    let followUps = [];
    if (parts.length > 1) {
      const listMatches = parts[1].match(/[-*] (.*)/g);
      if (listMatches) {
        followUps = listMatches.map(m => m.replace(/^[-*]\s*/, '').trim());
      }
    }

    return (
      <div className="w-full">
        <MarkdownRenderer content={mainContent} />
        {followUps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-graphite-700">
            <p className="text-xs font-semibold uppercase text-mist-500 mb-2">Suggested Follow-ups</p>
            <div className="flex flex-wrap gap-2">
              {followUps.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => sendQuery(question)}
                  className="text-left bg-graphite-700 hover:bg-graphite-600 px-3 py-2 rounded-lg text-sm text-mist-300 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-mist-100">Chat with Codebase</h1>
          <p className="mt-1 text-sm text-mist-500">
            Ask questions about your repository structure, logic, and architecture.
          </p>
        </div>
        <Link to="/dashboard/repositories" className="text-sm text-mist-500 hover:text-amber-400">
          ← Back to repositories
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-graphite-700 bg-graphite-900 p-4 mb-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-mist-500">
            <p>Start chatting with your codebase. Ask about how specific features work!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-4 ${
                  msg.role === 'user' 
                    ? 'bg-amber-400 text-graphite-950 rounded-tr-none' 
                    : 'bg-graphite-800 text-mist-100 rounded-tl-none'
                }`}>
                  {renderMessageContent(msg)}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg p-4 bg-graphite-800 text-mist-100 rounded-tl-none flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse delay-75"></span>
                  <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse delay-150"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this repository..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-graphite-600 bg-graphite-800 px-4 py-2 text-mist-100 outline-none focus:border-amber-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-amber-400 px-6 py-2 font-semibold text-graphite-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
