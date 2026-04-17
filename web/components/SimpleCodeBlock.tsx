import React from 'react';

interface SimpleCodeBlockProps {
  code: string;
  language: string;
  className?: string;
}

export default function SimpleCodeBlock({ code, language, className = '' }: SimpleCodeBlockProps) {
  return (
    <div className={`relative ${className}`}>
      <pre className="bg-background-tertiary border border-border rounded-lg p-4 overflow-x-auto">
        <code className="text-text-primary text-sm font-mono leading-relaxed">
          {code.trim()}
        </code>
      </pre>
      <button
        onClick={() => navigator.clipboard.writeText(code.trim())}
        className="absolute top-4 right-4 p-2 bg-background-secondary hover:bg-gray-600 rounded-lg text-text-secondary hover:text-white transition-colors duration-200"
        title="Copy code"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>
    </div>
  );
}