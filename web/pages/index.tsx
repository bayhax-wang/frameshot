import { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ thumbnail_url: string } | null>(null);
  const [apiKey, setApiKey] = useState('');

  const handleExtract = async () => {
    if (!apiKey) {
      alert('Please enter your API key');
      return;
    }
    
    if (!url && !file) {
      alert('Please provide a video URL or upload a file');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('url', url);
      }
      formData.append('format', 'jpg');
      formData.append('width', '1280');
      formData.append('timestamp', 'auto');

      const response = await fetch('/api/v1/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Extract failed:', error);
      alert('Frame extraction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Frameshot - Video Frame Extraction API</title>
        <meta name="description" content="Extract video frames with global CDN delivery" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <span className={styles.brand}>Frameshot</span>
        </h1>

        <p className={styles.description}>
          Video frame extraction API with global CDN delivery
        </p>

        <div className={styles.card}>
          <h2>Extract Frame</h2>
          
          <div className={styles.field}>
            <label>API Key</label>
            <input
              type="text"
              placeholder="fs_xxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label>Video URL</label>
            <input
              type="url"
              placeholder="https://example.com/video.mp4"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={styles.input}
              disabled={!!file}
            />
          </div>

          <div className={styles.or}>OR</div>

          <div className={styles.field}>
            <label>Upload Video</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className={styles.input}
              disabled={!!url}
            />
          </div>

          <button
            onClick={handleExtract}
            disabled={loading || (!url && !file) || !apiKey}
            className={styles.button}
          >
            {loading ? 'Extracting...' : 'Extract Frame'}
          </button>

          {result && (
            <div className={styles.result}>
              <h3>Result</h3>
              <img 
                src={result.thumbnail_url} 
                alt="Extracted frame"
                className={styles.thumbnail}
              />
              <p>
                <a href={result.thumbnail_url} target="_blank" rel="noopener noreferrer">
                  {result.thumbnail_url}
                </a>
              </p>
            </div>
          )}
        </div>

        <div className={styles.features}>
          <div className={styles.feature}>
            <h3>🎯 URL Input</h3>
            <p>Extract frames from any video URL</p>
          </div>
          <div className={styles.feature}>
            <h3>📁 Local Upload</h3>
            <p>Upload videos directly from your device</p>
          </div>
          <div className={styles.feature}>
            <h3>🎨 Multiple Formats</h3>
            <p>Support for JPG, PNG, and WebP</p>
          </div>
          <div className={styles.feature}>
            <h3>🌍 Global CDN</h3>
            <p>Fast delivery worldwide</p>
          </div>
        </div>

        <div className={styles.pricing}>
          <div className={styles.plan}>
            <h3>Free</h3>
            <p className={styles.price}>$0/month</p>
            <ul>
              <li>50 requests/month</li>
              <li>Basic support</li>
            </ul>
          </div>
          <div className={styles.plan}>
            <h3>Pro</h3>
            <p className={styles.price}>$9/month</p>
            <ul>
              <li>5,000 requests/month</li>
              <li>Priority support</li>
            </ul>
          </div>
          <div className={styles.plan}>
            <h3>Scale</h3>
            <p className={styles.price}>$29/month</p>
            <ul>
              <li>50,000 requests/month</li>
              <li>Dedicated support</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}