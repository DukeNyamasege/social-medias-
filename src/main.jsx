import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const initialChannels = [
  { id: 'tiktok-main', name: 'TikTok', account: '@mrduke', badge: 'TT', tone: 'pink', connected: true },
  { id: 'tiktok-alt', name: 'TikTok', account: '@mrduke2', badge: 'TT', tone: 'pink', connected: true },
  { id: 'instagram', name: 'Instagram', account: '@mrduke', badge: 'IG', tone: 'purple', connected: true },
  { id: 'facebook', name: 'Facebook', account: 'Mr Duke', badge: 'f', tone: 'blue', connected: true },
  { id: 'youtube', name: 'YouTube', account: 'Mr Duke', badge: '▶', tone: 'red', connected: true },
];

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 18a4 4 0 0 1-.4-7.98A6 6 0 0 1 18.2 8.6 4.5 4.5 0 0 1 18.5 18H7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15V9m0 0-2.4 2.4M12 9l2.4 2.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 2 1.45 4.55L18 8l-4.55 1.45L12 14l-1.45-4.55L6 8l4.55-1.45L12 2Z" fill="currentColor" />
      <path d="m19 14 .85 2.15L22 17l-2.15.85L19 20l-.85-2.15L16 17l2.15-.85L19 14Z" fill="currentColor" opacity=".7" />
    </svg>
  );
}

function App() {
  const [channels, setChannels] = useState(() => initialChannels.map((channel) => ({ ...channel, selected: true })));
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);

  const selectedCount = useMemo(() => channels.filter((channel) => channel.selected).length, [channels]);

  const selectFile = (nextFile) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('video/')) {
      setNotice('Please choose a video file.');
      return;
    }
    setFile(nextFile);
    setNotice('');
  };

  const toggleChannel = (id) => {
    setChannels((current) => current.map((channel) => channel.id === id ? { ...channel, selected: !channel.selected } : channel));
  };

  const handlePublish = () => {
    if (!file) {
      setNotice('Add a video before publishing.');
      return;
    }
    if (selectedCount === 0) {
      setNotice('Select at least one destination.');
      return;
    }
    setNotice('UI draft is ready. Live publishing will activate when we add each platform API and OAuth connection.');
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="publisher-card">
        <header className="publisher-header">
          <div>
            <div className="eyebrow"><span className="status-dot" /> Publisher online</div>
            <h1>Post once.<br /><span>Be everywhere.</span></h1>
            <p>Upload one video and send it to every connected social account from a single workspace.</p>
          </div>
          <div className="brand-mark" aria-label="Duke Social Publisher">
            <span>D</span>
            <small>SP</small>
          </div>
        </header>

        <div className="content-grid">
          <div className="left-column">
            <button
              type="button"
              className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                selectFile(event.dataTransfer.files?.[0]);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                hidden
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
              <div className="upload-icon"><CloudIcon /></div>
              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <span>{formatBytes(file.size)} · Ready to publish</span>
                  <em>Click to replace video</em>
                </>
              ) : (
                <>
                  <strong>Drop your video here</strong>
                  <span>or click to browse from your device</span>
                  <em>MP4, MOV, WEBM · short-form video ready</em>
                </>
              )}
            </button>

            <label className="field-label" htmlFor="caption">Caption</label>
            <div className="caption-box">
              <textarea
                id="caption"
                value={caption}
                maxLength={2200}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Write one caption for every platform..."
              />
              <div className="caption-footer">
                <button type="button" className="ghost-action"><SparkIcon /> Caption assist</button>
                <span>{caption.length}/2200</span>
              </div>
            </div>
          </div>

          <aside className="right-column">
            <div className="destination-heading">
              <div>
                <span className="section-kicker">Destinations</span>
                <h2>Choose where to post</h2>
              </div>
              <span className="count-pill">{selectedCount}/5</span>
            </div>

            <div className="channels">
              {channels.map((channel) => (
                <button
                  type="button"
                  key={channel.id}
                  className={`channel ${channel.selected ? 'selected' : ''}`}
                  onClick={() => toggleChannel(channel.id)}
                  aria-pressed={channel.selected}
                >
                  <span className={`platform-badge ${channel.tone}`}>{channel.badge}</span>
                  <span className="channel-copy">
                    <strong>{channel.name}</strong>
                    <small>{channel.account}</small>
                  </span>
                  <span className="connection"><i /> Connected</span>
                  <span className="checkmark">✓</span>
                </button>
              ))}
            </div>
          </aside>
        </div>

        <footer className="publisher-footer">
          <div className="publish-summary">
            <span>Ready for</span>
            <strong>{selectedCount} destination{selectedCount === 1 ? '' : 's'}</strong>
          </div>
          <button type="button" className="publish-button" onClick={handlePublish}>
            <span>Publish Everywhere</span>
            <b>↗</b>
          </button>
        </footer>

        {notice && <div className="notice" role="status">{notice}</div>}
      </section>

      <div className="prototype-note">First UI draft · API connections not yet activated</div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
