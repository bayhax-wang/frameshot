import React, { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';
import CodeBlock from '../components/SimpleCodeBlock';
import FeatureCard from '../components/FeatureCard';
import PricingCard from '../components/PricingCard';

const codeExamples = {
  curl: `curl -X POST "https://frameshot-api.vod-mates.workers.dev/api/v1/extract" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "video_url": "https://example.com/video.mp4",
    "timestamp": 10,
    "format": "jpg"
  }'`,
  
  python: `import requests

response = requests.post(
    "https://frameshot-api.vod-mates.workers.dev/api/v1/extract",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={
        "video_url": "https://example.com/video.mp4",
        "timestamp": 10,
        "format": "jpg"
    }
)

data = response.json()
frame_url = data["image_url"]`,

  javascript: `const response = await fetch(
  "https://frameshot-api.vod-mates.workers.dev/api/v1/extract",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_API_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video_url: "https://example.com/video.mp4",
      timestamp: 10,
      format: "jpg",
    }),
  }
);

const data = await response.json();
const frameUrl = data.image_url;`
};

export default function Home() {
  const [activeCodeExample, setActiveCodeExample] = useState('curl');
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const API_BASE = 'https://frameshot-api.vod-mates.workers.dev';

  const requestCode = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/keys/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to send code');
        return;
      }
      setStep('code');
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndCreateKey = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode, tier: 'free' }),
      });
      const data = await res.json() as any;
      if (!res.ok) {
        setErrorMsg(data.error || 'Verification failed');
        return;
      }
      setApiKey(data.api_key);
      setStep('done');
    } catch (err) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Head>
        <title>Frameshot - Extract perfect video frames with one API call</title>
        <meta name="description" content="The simplest API for video thumbnail generation. URL or file upload, any format, global CDN." />
      </Head>

      <Header />

      <main className="min-h-screen bg-background-primary">
        {/* Hero Section */}
        <section id="hero" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-8">
                Extract perfect video frames
                <br />
                <span className="text-accent-indigo">with one API call</span>
              </h1>
              <p className="text-xl text-text-secondary mb-12 max-w-3xl mx-auto leading-relaxed">
                The simplest API for video thumbnail generation. URL or file upload, any format, global CDN.
              </p>
              
              {/* Hero Code Example */}
              <div className="max-w-2xl mx-auto mb-12">
                <CodeBlock 
                  code={codeExamples.curl} 
                  language="bash"
                  className="text-left"
                />
              </div>

              {/* Hero CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <a
                  href="#get-started"
                  className="bg-accent-indigo hover:bg-accent-indigo-dark text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors duration-200 min-w-[200px]"
                >
                  Get Started Free
                </a>
                <a
                  href="#docs"
                  className="border border-border hover:border-accent-indigo text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors duration-200 min-w-[200px]"
                >
                  Read Docs
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-background-secondary/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-6">
                Everything you need to extract video frames
              </h2>
              <p className="text-xl text-text-secondary max-w-3xl mx-auto">
                Built for developers who need reliable video frame extraction without the complexity
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon="🔗"
                title="URL Input"
                description="Pass any video URL and get frames instantly. Works with YouTube, Vimeo, direct links, and more."
              />
              <FeatureCard
                icon="📁"
                title="File Upload"
                description="Upload local video files directly. Support for all major video formats including MP4, WebM, AVI."
              />
              <FeatureCard
                icon="🖼️"
                title="Multiple Formats"
                description="Get frames in JPG, PNG, or WebP. Customize quality, resolution, and compression settings."
              />
              <FeatureCard
                icon="🌍"
                title="Global CDN"
                description="Frames delivered via Cloudflare's global network for lightning-fast access worldwide."
              />
            </div>
          </div>
        </section>

        {/* Code Examples Section */}
        <section id="docs" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-6">
                Easy integration in any language
              </h2>
              <p className="text-xl text-text-secondary max-w-3xl mx-auto">
                Simple REST API that works with any programming language or tool
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              {/* Language Tabs */}
              <div className="flex flex-wrap justify-center mb-8 gap-2">
                {[
                  { key: 'curl', label: 'cURL' },
                  { key: 'python', label: 'Python' },
                  { key: 'javascript', label: 'JavaScript' }
                ].map((lang) => (
                  <button
                    key={lang.key}
                    onClick={() => setActiveCodeExample(lang.key)}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors duration-200 ${
                      activeCodeExample === lang.key
                        ? 'bg-accent-indigo text-white'
                        : 'bg-background-secondary text-text-secondary hover:text-white'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {/* Code Block */}
              <CodeBlock 
                code={codeExamples[activeCodeExample as keyof typeof codeExamples]} 
                language={activeCodeExample === 'curl' ? 'bash' : activeCodeExample}
              />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-background-secondary/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-6">
                Simple, transparent pricing
              </h2>
              <p className="text-xl text-text-secondary max-w-3xl mx-auto">
                Start free, scale as you grow. No hidden fees, no surprises.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <PricingCard
                name="Free"
                price="$0"
                description="Perfect for testing and small projects"
                features={[
                  "50 API calls per month",
                  "Basic video formats",
                  "Standard resolution",
                  "Community support"
                ]}
                cta="Get Started Free"
              />
              <PricingCard
                name="Pro"
                price="$9"
                description="For growing applications"
                features={[
                  "5,000 API calls per month",
                  "All video formats",
                  "High resolution frames",
                  "Email support",
                  "Custom timestamps"
                ]}
                cta="Start Pro Plan"
                highlighted={true}
              />
              <PricingCard
                name="Scale"
                price="$29"
                description="For high-volume applications"
                features={[
                  "50,000 API calls per month",
                  "Priority processing",
                  "Custom resolutions",
                  "Priority support",
                  "Bulk operations"
                ]}
                cta="Start Scale Plan"
              />
            </div>
          </div>
        </section>

        {/* Get Started Section */}
        <section id="get-started" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to extract video frames?
            </h2>
            <p className="text-xl text-text-secondary mb-12">
              Get your API key and start extracting frames in minutes
            </p>
            
            <div className="bg-background-secondary border border-border rounded-xl p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                <div>
                  <div className="w-12 h-12 bg-accent-indigo rounded-lg flex items-center justify-center mb-4">
                    <span className="text-white font-bold text-lg">1</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Sign up</h3>
                  <p className="text-text-secondary">Create your account and get instant access to the API</p>
                </div>
                <div>
                  <div className="w-12 h-12 bg-accent-indigo rounded-lg flex items-center justify-center mb-4">
                    <span className="text-white font-bold text-lg">2</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Get API Key</h3>
                  <p className="text-text-secondary">Receive your API key immediately after registration</p>
                </div>
                <div>
                  <div className="w-12 h-12 bg-accent-indigo rounded-lg flex items-center justify-center mb-4">
                    <span className="text-white font-bold text-lg">3</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Start Extracting</h3>
                  <p className="text-text-secondary">Make your first API call and extract your first frame</p>
                </div>
              </div>
              
              <div className="mt-12 max-w-md mx-auto">
                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-4 text-sm">
                    {errorMsg}
                  </div>
                )}

                {step === 'email' && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && email && requestCode()}
                      className="flex-1 bg-background-tertiary border border-border rounded-lg px-4 py-4 text-white placeholder-text-secondary focus:outline-none focus:border-accent-indigo transition-colors"
                    />
                    <button
                      onClick={requestCode}
                      disabled={isLoading || !email}
                      className="bg-accent-indigo hover:bg-accent-indigo-dark text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isLoading ? 'Sending...' : 'Get API Key'}
                    </button>
                  </div>
                )}

                {step === 'code' && (
                  <div>
                    <p className="text-text-secondary text-sm mb-3">We sent a 6-digit code to <span className="text-white">{email}</span></p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={(e) => e.key === 'Enter' && verificationCode.length === 6 && verifyAndCreateKey()}
                        maxLength={6}
                        className="flex-1 bg-background-tertiary border border-border rounded-lg px-4 py-4 text-white text-center text-2xl tracking-[0.3em] font-mono placeholder-text-secondary focus:outline-none focus:border-accent-indigo transition-colors"
                      />
                      <button
                        onClick={verifyAndCreateKey}
                        disabled={isLoading || verificationCode.length !== 6}
                        className="bg-accent-indigo hover:bg-accent-indigo-dark text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {isLoading ? 'Verifying...' : 'Verify'}
                      </button>
                    </div>
                    <button
                      onClick={() => { setStep('email'); setVerificationCode(''); setErrorMsg(''); }}
                      className="text-text-secondary hover:text-white text-sm mt-3 transition-colors"
                    >
                      ← Use a different email
                    </button>
                  </div>
                )}

                {step === 'done' && (
                  <div className="bg-background-tertiary border border-accent-indigo/30 rounded-lg p-6">
                    <p className="text-green-400 text-sm mb-3">✓ API key created! Also sent to your email.</p>
                    <div className="flex items-center gap-3">
                      <code className="text-accent-indigo font-mono text-lg flex-1 break-all">{apiKey}</code>
                      <button
                        onClick={copyApiKey}
                        className="bg-accent-indigo hover:bg-accent-indigo-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 whitespace-nowrap"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-text-secondary text-xs mt-3">Free tier · 50 API calls/month</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0">
                <h3 className="text-xl font-bold text-white">
                  <span className="text-accent-indigo">Frame</span>shot
                </h3>
                <p className="text-text-secondary mt-1">
                  Extract perfect video frames with one API call
                </p>
              </div>
              
              <div className="flex items-center space-x-6">
                <a
                  href="https://github.com/bayhax-wang/frameshot"
                  className="text-text-secondary hover:text-white transition-colors duration-200"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
                <p className="text-text-secondary">
                  © 2024 Frameshot. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}