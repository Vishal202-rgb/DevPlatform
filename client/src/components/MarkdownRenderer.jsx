import React, { useState } from 'react';

// Lightweight, zero-dependency token-based syntax highlighter
function highlightCode(code, _lang = '') {
  // Helper to escape HTML characters
  const escapeHtml = (str) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  // Split into lines to highlight line by line
  const lines = code.split('\n');

  const highlightedLines = lines.map((line) => {
    // If it's a full-line comment
    if (/^\s*(\/\/|#|\/\*)/.test(line)) {
      return `<span class="text-mist-500 italic">${escapeHtml(line)}</span>`;
    }

    let escaped = escapeHtml(line);

    // Comments at end of line
    escaped = escaped.replace(
      /(\/\/.*$|#.*$)/g,
      '<span class="text-mist-500 italic">$1</span>'
    );

    // Strings
    escaped = escaped.replace(
      /(["'`])(.*?)\1/g,
      '<span class="text-emerald-400">$1$2$1</span>'
    );

    // Numbers
    escaped = escaped.replace(
      /\b(\d+(?:\.\d+)?)\b/g,
      '<span class="text-amber-300">$1</span>'
    );

    // Keywords
    const keywords = [
      'const', 'let', 'var', 'function', 'class', 'import', 'export', 'from',
      'default', 'return', 'async', 'await', 'if', 'else', 'for', 'while',
      'switch', 'case', 'break', 'try', 'catch', 'throw', 'new', 'typeof',
      'instanceof', 'void', 'this', 'super', 'extends', 'def', 'elif', 'with',
      'as', 'yield', 'lambda', 'pass', 'None', 'True', 'False', 'package',
      'interface', 'type', 'struct', 'public', 'private', 'static'
    ];
    const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    escaped = escaped.replace(
      kwRegex,
      '<span class="text-purple-400 font-semibold">$1</span>'
    );

    // Built-in types / primitives
    const types = ['string', 'number', 'boolean', 'any', 'void', 'Promise', 'Array', 'Object', 'null', 'undefined', 'int', 'float', 'str', 'bool', 'dict', 'list'];
    const typeRegex = new RegExp(`\\b(${types.join('|')})\\b`, 'g');
    escaped = escaped.replace(
      typeRegex,
      '<span class="text-sky-400 font-medium">$1</span>'
    );

    // Function calls
    escaped = escaped.replace(
      /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()/g,
      '<span class="text-blue-300">$1</span>'
    );

    return escaped;
  });

  return highlightedLines.join('\n');
}

export function CopyCodeButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="flex items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-800 px-2 py-1 text-[11px] font-mono text-mist-300 transition-colors hover:border-graphite-600 hover:bg-graphite-700 hover:text-mist-100"
      aria-label="Copy code snippet"
    >
      {copied ? (
        <>
          <span className="text-emerald-400">✓</span>
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  const blocks = [];
  const lines = content.split('\n');
  let currentBlock = { type: 'text', content: [] };
  let inCodeBlock = false;
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push(currentBlock);
        currentBlock = { type: 'text', content: [] };
        inCodeBlock = false;
      } else {
        if (currentBlock.content.length > 0) {
          blocks.push(currentBlock);
        }
        codeLang = line.replace('```', '').trim();
        currentBlock = { type: 'code', lang: codeLang, content: [] };
        inCodeBlock = true;
      }
    } else {
      currentBlock.content.push(line);
    }
  }
  if (currentBlock.content.length > 0) {
    blocks.push(currentBlock);
  }

  const parseInline = (text, keyPrefix) => {
    // Regex matches bold, inline code, links, file references (e.g. `path/file.js:10`)
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={`${keyPrefix}-${idx}`} className="font-semibold text-mist-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const codeVal = part.slice(1, -1);
        return (
          <code
            key={`${keyPrefix}-${idx}`}
            className="rounded bg-graphite-800 border border-graphite-700/80 px-1.5 py-0.5 font-mono text-[12px] text-amber-300"
          >
            {codeVal}
          </code>
        );
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const titleMatch = part.match(/\[(.*?)\]/);
        const urlMatch = part.match(/\((.*?)\)/);
        if (titleMatch && urlMatch) {
          return (
            <a
              key={`${keyPrefix}-${idx}`}
              href={urlMatch[1]}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
            >
              {titleMatch[1]}
            </a>
          );
        }
      }
      return <React.Fragment key={`${keyPrefix}-${idx}`}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-4 text-xs sm:text-sm text-mist-300 leading-relaxed">
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          const codeText = block.content.join('\n');
          const highlightedHtml = highlightCode(codeText, block.lang);

          return (
            <div
              key={i}
              className="group relative my-3 overflow-hidden rounded-xl border border-graphite-700 bg-graphite-950 shadow-xl"
            >
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-graphite-800 bg-graphite-900/90 px-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/40" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500/40" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/40" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-mist-500">
                    {block.lang || 'code'}
                  </span>
                </div>

                <CopyCodeButton text={codeText} />
              </div>

              {/* Syntax Highlighted Code block */}
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-mist-200">
                <code
                  dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                  className="font-mono"
                />
              </pre>
            </div>
          );
        }

        // Text block
        let inList = false;
        const textElements = [];

        block.content.forEach((line, j) => {
          if (line.match(/^[-*] /)) {
            inList = true;
            textElements.push(
              <li key={`li-${i}-${j}`} className="ml-5 list-disc text-mist-300 my-1">
                {parseInline(line.replace(/^[-*] /, ''), `inline-${i}-${j}`)}
              </li>
            );
          } else if (line.match(/^\d+\. /)) {
            inList = true;
            textElements.push(
              <li key={`li-${i}-${j}`} className="ml-5 list-decimal text-mist-300 my-1">
                {parseInline(line.replace(/^\d+\. /, ''), `inline-${i}-${j}`)}
              </li>
            );
          } else {
            if (inList) {
              inList = false;
              textElements.push(<div key={`br-list-${i}-${j}`} className="h-1.5" />);
            }
            if (line.trim() === '') {
              textElements.push(<div key={`br-${i}-${j}`} className="h-2" />);
            } else if (line.startsWith('### ')) {
              textElements.push(
                <h3 key={`h3-${i}-${j}`} className="mt-4 mb-1.5 text-sm sm:text-base font-semibold text-mist-100">
                  {parseInline(line.replace('### ', ''), `inline-${i}-${j}`)}
                </h3>
              );
            } else if (line.startsWith('## ')) {
              textElements.push(
                <h2 key={`h2-${i}-${j}`} className="mt-5 mb-2 text-base sm:text-lg font-semibold text-mist-100 border-b border-graphite-800 pb-1">
                  {parseInline(line.replace('## ', ''), `inline-${i}-${j}`)}
                </h2>
              );
            } else if (line.startsWith('# ')) {
              textElements.push(
                <h1 key={`h1-${i}-${j}`} className="mt-6 mb-2.5 text-lg sm:text-xl font-bold text-mist-100">
                  {parseInline(line.replace('# ', ''), `inline-${i}-${j}`)}
                </h1>
              );
            } else {
              textElements.push(
                <p key={`p-${i}-${j}`} className="mb-2 leading-relaxed">
                  {parseInline(line, `inline-${i}-${j}`)}
                </p>
              );
            }
          }
        });

        return (
          <div key={i} className="text-mist-300">
            {textElements}
          </div>
        );
      })}
    </div>
  );
}
