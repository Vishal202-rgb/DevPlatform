import React, { useState } from 'react';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded bg-graphite-700 px-2 py-1 text-[10px] font-semibold text-mist-300 hover:bg-graphite-600 hover:text-white"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

export default function MarkdownRenderer({ content }) {
  // A minimal, zero-dependency Markdown parser that handles:
  // - Code blocks with copy buttons
  // - Inline code
  // - Bold text
  // - Lists
  // - Links
  // - Newlines

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
    // We split by tokens. This is a very naive regex-based inline parser
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    const parts = text.split(regex);
    
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${keyPrefix}-${idx}`} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={`${keyPrefix}-${idx}`} className="rounded bg-graphite-800 px-1 py-0.5 font-mono text-sm text-amber-400">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
        const titleMatch = part.match(/\[(.*?)\]/);
        const urlMatch = part.match(/\((.*?)\)/);
        if (titleMatch && urlMatch) {
          return (
            <a key={`${keyPrefix}-${idx}`} href={urlMatch[1]} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">
              {titleMatch[1]}
            </a>
          );
        }
      }
      return <React.Fragment key={`${keyPrefix}-${idx}`}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        if (block.type === 'code') {
          const codeText = block.content.join('\n');
          return (
            <div key={i} className="relative mt-2 rounded-lg bg-graphite-950 p-4">
              {block.lang && (
                <div className="absolute left-4 top-2 text-[10px] font-semibold uppercase text-mist-500">
                  {block.lang}
                </div>
              )}
              <CopyButton text={codeText} />
              <pre className="mt-4 overflow-x-auto font-mono text-sm text-mist-100">
                <code>{codeText}</code>
              </pre>
            </div>
          );
        }

        // text block
        const pLines = [];
        let inList = false;
        const textElements = [];

        block.content.forEach((line, j) => {
          if (line.match(/^[-*] /)) {
            inList = true;
            textElements.push(
              <li key={`li-${i}-${j}`} className="ml-4 list-disc">
                {parseInline(line.replace(/^[-*] /, ''), `inline-${i}-${j}`)}
              </li>
            );
          } else if (line.match(/^\d+\. /)) {
            inList = true;
            textElements.push(
              <li key={`li-${i}-${j}`} className="ml-4 list-decimal">
                {parseInline(line.replace(/^\d+\. /, ''), `inline-${i}-${j}`)}
              </li>
            );
          } else {
            if (inList) {
              inList = false;
              textElements.push(<div key={`br-list-${i}-${j}`} className="h-2" />);
            }
            if (line.trim() === '') {
              textElements.push(<div key={`br-${i}-${j}`} className="h-2" />);
            } else if (line.startsWith('### ')) {
              textElements.push(
                <h3 key={`h3-${i}-${j}`} className="mt-4 text-lg font-semibold text-mist-100">
                  {parseInline(line.replace('### ', ''), `inline-${i}-${j}`)}
                </h3>
              );
            } else if (line.startsWith('## ')) {
              textElements.push(
                <h2 key={`h2-${i}-${j}`} className="mt-5 text-xl font-semibold text-mist-100">
                  {parseInline(line.replace('## ', ''), `inline-${i}-${j}`)}
                </h2>
              );
            } else if (line.startsWith('# ')) {
              textElements.push(
                <h1 key={`h1-${i}-${j}`} className="mt-6 text-2xl font-bold text-mist-100">
                  {parseInline(line.replace('# ', ''), `inline-${i}-${j}`)}
                </h1>
              );
            } else {
              textElements.push(
                <p key={`p-${i}-${j}`} className="mb-1">
                  {parseInline(line, `inline-${i}-${j}`)}
                </p>
              );
            }
          }
        });

        return (
          <div key={i} className="text-mist-100">
            {textElements}
          </div>
        );
      })}
    </div>
  );
}
