import React, { useState } from 'react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background-primary/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-white">
                <span className="text-accent-indigo">Frame</span>shot
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <a href="#docs" className="text-text-secondary hover:text-white transition-colors duration-200">
                Docs
              </a>
              <a href="#pricing" className="text-text-secondary hover:text-white transition-colors duration-200">
                Pricing
              </a>
            </div>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <a
              href="#get-started"
              className="bg-accent-indigo hover:bg-accent-indigo-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              Get API Key
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="bg-background-secondary inline-flex items-center justify-center p-2 rounded-md text-text-secondary hover:text-white hover:bg-background-tertiary transition-colors duration-200"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path
                  className={mobileMenuOpen ? 'hidden' : 'inline-flex'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
                <path
                  className={mobileMenuOpen ? 'inline-flex' : 'hidden'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-background-secondary border-b border-border">
            <a href="#docs" className="block px-3 py-2 text-text-secondary hover:text-white">
              Docs
            </a>
            <a href="#pricing" className="block px-3 py-2 text-text-secondary hover:text-white">
              Pricing
            </a>
            <a
              href="#get-started"
              className="block px-3 py-2 bg-accent-indigo text-white rounded-lg text-center font-medium"
            >
              Get API Key
            </a>
          </div>
        </div>
      )}
    </header>
  );
}