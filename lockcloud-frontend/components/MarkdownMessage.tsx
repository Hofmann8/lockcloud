'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
}

// Language name mapping for better display
const languageNames: Record<string, string> = {
  js: 'JavaScript',
  jsx: 'React JSX',
  ts: 'TypeScript',
  tsx: 'React TSX',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  cs: 'C#',
  go: 'Go',
  rust: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  md: 'Markdown',
  markdown: 'Markdown',
  bash: 'Bash',
  sh: 'Shell',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  graphql: 'GraphQL',
};

// Enhanced language detection based on code patterns
const detectLanguage = (code: string): string => {
  const trimmedCode = code.trim();
  const firstLine = trimmedCode.split('\n')[0].toLowerCase();
  
  // Check for common file extensions or comments
  if (firstLine.includes('.py') || firstLine.includes('python')) return 'python';
  if (firstLine.includes('.js') || firstLine.includes('javascript')) return 'javascript';
  if (firstLine.includes('.ts') || firstLine.includes('typescript')) return 'typescript';
  if (firstLine.includes('.java')) return 'java';
  if (firstLine.includes('.cpp') || firstLine.includes('.cc')) return 'cpp';
  if (firstLine.includes('.c') && !firstLine.includes('.cs')) return 'c';
  if (firstLine.includes('.cs') || firstLine.includes('c#')) return 'csharp';
  if (firstLine.includes('.go')) return 'go';
  if (firstLine.includes('.rs') || firstLine.includes('rust')) return 'rust';
  if (firstLine.includes('.rb') || firstLine.includes('ruby')) return 'ruby';
  if (firstLine.includes('.php')) return 'php';
  if (firstLine.includes('.sql')) return 'sql';
  if (firstLine.includes('.sh') || firstLine.includes('bash')) return 'bash';
  
  // Python - check for common patterns
  if (/(^|\n)(def |class |import |from .* import|if __name__|print\(|async def|@\w+\n)/m.test(trimmedCode)) {
    return 'python';
  }
  
  // JavaScript/TypeScript - check for common patterns
  if (/(const |let |var |function |=>|import .* from|export |require\()/m.test(trimmedCode)) {
    // TypeScript specific
    if (/:\s*(string|number|boolean|any|void|unknown|never)\b|interface |type |enum |namespace |<.*>/m.test(trimmedCode)) {
      return 'typescript';
    }
    return 'javascript';
  }
  
  // Java
  if (/(public |private |protected )*(class |interface |enum )|import java\.|System\.out\.println/m.test(trimmedCode)) {
    return 'java';
  }
  
  // C/C++
  if (/#include <|using namespace|std::|cout <<|printf\(/m.test(trimmedCode)) {
    if (/std::|namespace|class |template </m.test(trimmedCode)) {
      return 'cpp';
    }
    return 'c';
  }
  
  // C#
  if (/using System;|namespace |Console\.WriteLine|public class/m.test(trimmedCode)) {
    return 'csharp';
  }
  
  // Go
  if (/^package |func |import \(|fmt\.Print/m.test(trimmedCode)) {
    return 'go';
  }
  
  // Rust
  if (/fn |let mut |impl |use |pub |println!/m.test(trimmedCode)) {
    return 'rust';
  }
  
  // Ruby
  if (/^(def |class |module |require |puts |end$)/m.test(trimmedCode)) {
    return 'ruby';
  }
  
  // PHP
  if (/^<\?php|^\$\w+\s*=|echo |function \w+\(/m.test(trimmedCode)) {
    return 'php';
  }
  
  // HTML
  if (/^<!DOCTYPE html>|^<html|^<head|^<body|^<div|^<span|^<p>/m.test(trimmedCode)) {
    return 'html';
  }
  
  // CSS/SCSS
  if (/^[.#@][\w-]+\s*\{|^\w+\s*\{|@media|@import/m.test(trimmedCode)) {
    if (/@mixin|@include|\$\w+:/m.test(trimmedCode)) {
      return 'scss';
    }
    return 'css';
  }
  
  // JSON
  if (/^\s*[\{\[]/.test(trimmedCode) && /[\}\]]\s*$/.test(trimmedCode)) {
    try {
      JSON.parse(trimmedCode);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  
  // YAML
  if (/^[\w-]+:\s*$|^  [\w-]+:/m.test(trimmedCode) && !trimmedCode.includes('{')) {
    return 'yaml';
  }
  
  // SQL
  if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\s/im.test(trimmedCode)) {
    return 'sql';
  }
  
  // Bash/Shell
  if (/^#!\/bin\/(bash|sh)|^\$\s|^(cd|ls|mkdir|rm|cp|mv|grep|cat|echo|curl|wget|apt|yum|npm|pip)\s/m.test(trimmedCode)) {
    return 'bash';
  }
  
  // PowerShell
  if (/\$\w+\s*=|Get-|Set-|New-|Remove-|Write-Host/m.test(trimmedCode)) {
    return 'powershell';
  }
  
  // Dockerfile
  if (/^FROM |^RUN |^COPY |^ADD |^WORKDIR |^EXPOSE |^CMD |^ENTRYPOINT /m.test(trimmedCode)) {
    return 'dockerfile';
  }
  
  // Default to plaintext
  return 'text';
};

function MarkdownMessage({ content, isUser = false }: MarkdownMessageProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  if (isUser) {
    return <div className="whitespace-pre-wrap wrap-break-word">{content}</div>;
  }

  // Decode HTML entities
  const decodeHtmlEntities = (text: string): string => {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  };

  // Preprocess content to handle HTML-escaped code blocks and math
  const preprocessContent = (text: string): string => {
    let processed = text;
    
    // Convert <pre><code> blocks to markdown code blocks
    processed = processed.replace(
      /<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
      (match, codeContent) => {
        const decoded = decodeHtmlEntities(codeContent);
        const detectedLang = detectLanguage(decoded);
        return `\n\`\`\`${detectedLang}\n${decoded}\n\`\`\`\n`;
      }
    );
    
    // Convert inline <code> to markdown inline code
    processed = processed.replace(
      /<code[^>]*>(.*?)<\/code>/gi,
      (match, codeContent) => {
        const decoded = decodeHtmlEntities(codeContent);
        return `\`${decoded}\``;
      }
    );
    
    // Fix LaTeX math delimiters - convert \[ \] to $$
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
      return `$$${math}$$`;
    });
    
    // Fix LaTeX math delimiters - convert \( \) to $
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
      return `$${math}$`;
    });
    
    // Ensure display math has proper spacing
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
      return `\n$$${math.trim()}$$\n`;
    });
    
    return processed;
  };

  const processedContent = preprocessContent(content);

  return (
    <div className="markdown-content prose prose-sm max-w-none">
      <style jsx global>{`
        .katex { font-size: 1.1em; }
        .katex-display { 
          overflow-x: auto; 
          overflow-y: hidden;
          padding: 1em 0;
        }
        .katex-display > .katex {
          text-align: center;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code(props: any) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const inline = !className;
            
            // Handle inline code
            if (inline) {
              return (
                <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono" {...rest}>
                  {children}
                </code>
              );
            }
            
            // Handle code blocks
            const detectedLang = match ? match[1] : detectLanguage(codeString);
            const displayLang = languageNames[detectedLang] || detectedLang.toUpperCase();
            const isCopied = copiedCode === codeString;
            
            return (
              <div className="relative group my-4 rounded-lg overflow-hidden border border-gray-700 shadow-lg">
                {/* Code block header */}
                <div className="flex items-center justify-between bg-gray-800 px-4 py-2.5 border-b border-gray-700">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-300">{displayLang}</span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(codeString)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 ${
                      isCopied
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                    title={isCopied ? '已复制到剪贴板' : '复制代码'}
                  >
                    {isCopied ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>已复制</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>复制代码</span>
                      </>
                    )}
                  </button>
                </div>
                
                {/* Code content */}
                <div className="relative">
                  <SyntaxHighlighter
                    style={oneDark}
                    language={detectedLang}
                    PreTag="div"
                    showLineNumbers={codeString.split('\n').length > 5}
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      background: '#282c34',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: "'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace",
                      }
                    }}
                    {...rest}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              </div>
            );
          },
          p({ children }) {
            return <p className="mb-3 leading-7">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-7">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-2xl font-bold mb-3 mt-4">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-xl font-bold mb-3 mt-4">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-lg font-bold mb-2 mt-3">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="text-base font-bold mb-2 mt-3">{children}</h4>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-orange-400 pl-4 py-2 my-3 bg-orange-50 text-gray-700">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 underline decoration-2 underline-offset-2"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4 rounded-lg border border-gray-300">
                <table className="min-w-full border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-gray-100">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-700">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border border-gray-300 px-4 py-2">{children}</td>;
          },
          tr({ children }) {
            return <tr className="hover:bg-gray-50 transition-colors">{children}</tr>;
          },
          hr() {
            return <hr className="my-4 border-gray-300" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-gray-900">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-gray-700">{children}</em>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

// Use memo to prevent unnecessary re-renders
export default React.memo(MarkdownMessage);
