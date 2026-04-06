'use client';

import { useState, useRef, useCallback } from 'react';

const STATES = {
  IDLE: 'idle',
  FETCHING_INFO: 'fetching_info',
  INFO_LOADED: 'info_loaded',
  GENERATING: 'generating',
  COMPLETE: 'complete',
  ERROR: 'error',
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [appState, setAppState] = useState(STATES.IDLE);
  const [bookInfo, setBookInfo] = useState(null);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [extractionType, setExtractionType] = useState('standard');
  const [progress, setProgress] = useState({ current: 0, total: 0, chapterTitle: '' });
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [downloadData, setDownloadData] = useState(null);
  const abortRef = useRef(null);

  const fetchBookInfo = useCallback(async () => {
    if (!url.trim()) return;

    setError('');
    setAppState(STATES.FETCHING_INFO);

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch book info');
      }

      if (!data.chapters || data.chapters.length === 0) {
        throw new Error('No chapters found for this fiction.');
      }

      setBookInfo(data);
      setSelectedChapters(data.chapters.map((_, i) => i));
      setAppState(STATES.INFO_LOADED);
    } catch (err) {
      setError(err.message);
      setAppState(STATES.ERROR);
    }
  }, [url]);

  const generateEpub = useCallback(async () => {
    if (!bookInfo || selectedChapters.length === 0) return;

    setAppState(STATES.GENERATING);
    setProgress({ current: 0, total: selectedChapters.length, chapterTitle: '' });
    setStatusMsg('Starting...');

    const chaptersToDownload = selectedChapters
      .sort((a, b) => a - b)
      .map(i => bookInfo.chapters[i]);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapters: chaptersToDownload,
          title: bookInfo.title,
          author: bookInfo.author,
          coverUrl: bookInfo.coverUrl,
          extractionType,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'progress':
                  setProgress({
                    current: event.current,
                    total: event.total,
                    chapterTitle: event.chapterTitle,
                  });
                  setStatusMsg(`Fetching: ${event.chapterTitle}`);
                  break;

                case 'generating':
                  setStatusMsg('Compiling EPUB...');
                  break;

                case 'complete':
                  setDownloadData({
                    filename: event.filename,
                    data: event.data,
                    size: event.size,
                  });
                  setAppState(STATES.COMPLETE);
                  break;

                case 'error':
                  throw new Error(event.message);
              }
            } catch (parseErr) {
              if (parseErr.message !== 'Unexpected end of JSON input') {
                throw parseErr;
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err.message);
      setAppState(STATES.ERROR);
    }
  }, [bookInfo, selectedChapters]);

  const handleDownload = useCallback(() => {
    if (!downloadData) return;

    const byteString = atob(downloadData.data);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, [downloadData]);

  const reset = useCallback(() => {
    setAppState(STATES.IDLE);
    setBookInfo(null);
    setSelectedChapters([]);
    setProgress({ current: 0, total: 0, chapterTitle: '' });
    setStatusMsg('');
    setError('');
    setDownloadData(null);
    setUrl('');
  }, []);

  const toggleChapter = useCallback((index) => {
    setSelectedChapters(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index].sort((a, b) => a - b)
    );
  }, []);

  const selectAll = useCallback(() => {
    if (bookInfo) setSelectedChapters(bookInfo.chapters.map((_, i) => i));
  }, [bookInfo]);

  const selectNone = useCallback(() => {
    setSelectedChapters([]);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') fetchBookInfo();
  }, [fetchBookInfo]);

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Background Effects */}
      <div className="bg-effects">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <main className="main-container">
        {/* Header */}
        <header className="header">
          <div className="header-icon">📖</div>
          <h1>Royal Road to EPUB</h1>
          <p>Convert your favorite web novels into beautifully formatted EPUB files for offline reading</p>
        </header>

        {/* Main Card */}
        <div className="card">
          {/* URL Input */}
          {(appState === STATES.IDLE || appState === STATES.FETCHING_INFO || appState === STATES.ERROR) && (
            <>
              <div className="input-group">
                <input
                  id="url-input"
                  type="url"
                  className="url-input"
                  placeholder="https://www.royalroad.com/fiction/21220/mother-of-learning"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={appState === STATES.FETCHING_INFO}
                />
                <button
                  id="btn-fetch"
                  className="btn-primary"
                  onClick={fetchBookInfo}
                  disabled={!url.trim() || appState === STATES.FETCHING_INFO}
                >
                  {appState === STATES.FETCHING_INFO ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      <span className="btn-icon">🔍</span>
                      Fetch
                    </>
                  )}
                </button>
              </div>
              {error && <div className="error-msg">{error}</div>}
            </>
          )}

          {/* Book Info Preview */}
          {bookInfo && (appState === STATES.INFO_LOADED || appState === STATES.GENERATING) && (
            <>
              <div className="book-info">
                <div className="book-header">
                  {bookInfo.coverUrl && (
                    <img
                      className="book-cover"
                      src={bookInfo.coverUrl}
                      alt={`${bookInfo.title} cover`}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="book-meta">
                    <div className="book-title">{bookInfo.title}</div>
                    <div className="book-author">by {bookInfo.author}</div>
                    {bookInfo.description && (
                      <div className="book-description">{bookInfo.description}</div>
                    )}
                  </div>
                </div>
                <div className="book-stats">
                  <div className="stat">
                    <div className="stat-value">{bookInfo.chapters.length}</div>
                    <div className="stat-label">Chapters</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{selectedChapters.length}</div>
                    <div className="stat-label">Selected</div>
                  </div>
                </div>
              </div>

              {/* Chapter Selection */}
              {appState === STATES.INFO_LOADED && (
                <div className="chapter-selection">
                  <div className="selection-header">
                    <span className="selection-title">Select Chapters</span>
                    <div className="selection-controls">
                      <button className="btn-sm" onClick={selectAll}>All</button>
                      <button className="btn-sm" onClick={selectNone}>None</button>
                    </div>
                  </div>
                  <div className="chapter-list">
                    {bookInfo.chapters.map((chapter, index) => (
                      <label key={index} className="chapter-item">
                        <input
                          type="checkbox"
                          className="chapter-checkbox"
                          checked={selectedChapters.includes(index)}
                          onChange={() => toggleChapter(index)}
                        />
                        <span className="chapter-number">{index + 1}</span>
                        <span className="chapter-name">{chapter.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              {appState === STATES.GENERATING && (
                <div className="progress-section">
                  <div className="progress-header">
                    <span className="progress-title">Downloading Chapters</span>
                    <span className="progress-count">{progress.current} / {progress.total}</span>
                  </div>
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="progress-status">{statusMsg}</div>
                </div>
              )}

              {/* Generate Button */}
              {appState === STATES.INFO_LOADED && (
                <div className="generate-wrapper">
                  <div className="extraction-options" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', color: '#ccc', fontSize: '0.9rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        value="standard" 
                        checked={extractionType === 'standard'} 
                        onChange={(e) => setExtractionType(e.target.value)} 
                        style={{ accentColor: '#8b5cf6' }}
                      />
                      Standard (Fast)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        value="browser" 
                        checked={extractionType === 'browser'} 
                        onChange={(e) => setExtractionType(e.target.value)} 
                        style={{ accentColor: '#8b5cf6' }}
                      />
                      Browser Extractor (Accurate)
                    </label>
                  </div>
                  <button
                    id="btn-generate"
                    className="btn-generate"
                    onClick={generateEpub}
                    disabled={selectedChapters.length === 0}
                  >
                    📚 Generate EPUB ({selectedChapters.length} chapters)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Download Complete */}
          {appState === STATES.COMPLETE && downloadData && (
            <div className="download-section">
              <div className="download-icon">✅</div>
              <div className="download-title">EPUB Ready!</div>
              <div className="download-meta">
                {downloadData.filename} · {formatBytes(downloadData.size)}
              </div>
              <button
                id="btn-download"
                className="btn-download"
                onClick={handleDownload}
              >
                ⬇️ Download EPUB
              </button>
              <button className="btn-restart" onClick={reset}>
                ← Convert another book
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="footer">
          <p>For personal offline reading only · Respects rate limits · Built with ❤️</p>
        </footer>
      </main>
    </>
  );
}
