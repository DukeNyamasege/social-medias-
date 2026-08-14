import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const ACCOUNT_DEFINITIONS = [
  {
    slot: 'tiktok-1',
    platform: 'TikTok',
    label: 'TikTok account 1',
    badge: 'TT',
    tone: 'pink',
    note: 'Login Kit + Content Posting API',
    scopes: ['user.info.basic', 'video.publish'],
  },
  {
    slot: 'tiktok-2',
    platform: 'TikTok',
    label: 'TikTok account 2',
    badge: 'TT',
    tone: 'pink',
    note: 'Separate authorization for your second account',
    scopes: ['user.info.basic', 'video.publish'],
  },
  {
    slot: 'instagram',
    platform: 'Instagram',
    label: 'Instagram Professional',
    badge: 'IG',
    tone: 'purple',
    note: 'Meta Graph API · professional account required',
    scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'],
  },
  {
    slot: 'facebook',
    platform: 'Facebook',
    label: 'Facebook Page',
    badge: 'f',
    tone: 'blue',
    note: 'Meta Graph API · Page publishing',
    scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
  },
  {
    slot: 'youtube',
    platform: 'YouTube',
    label: 'YouTube channel',
    badge: '▶',
    tone: 'red',
    note: 'YouTube Data API v3',
    scopes: ['youtube.upload', 'youtube.readonly'],
  },
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

function localDateTimeValue(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function presetDate(kind) {
  const next = new Date();
  next.setSeconds(0, 0);
  if (kind === 'evening') {
    next.setHours(19, 0, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
  }
  if (kind === 'tomorrow') {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
  }
  if (kind === 'day-after') {
    next.setDate(next.getDate() + 2);
    next.setHours(9, 0, 0, 0);
  }
  return localDateTimeValue(next);
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 18a4 4 0 0 1-.4-7.98A6 6 0 0 1 18.2 8.6 4.5 4.5 0 0 1 18.5 18H7Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15V9m0 0-2.4 2.4M12 9l2.4 2.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function App() {
  const [connections, setConnections] = useState(() => ACCOUNT_DEFINITIONS.map((item) => ({
    ...item,
    configured: null,
    connected: false,
    account: null,
    missingEnvironment: [],
    lastError: null,
  })));
  const [selected, setSelected] = useState([]);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('info');
  const [busySlot, setBusySlot] = useState('');
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [publishMode, setPublishMode] = useState('now');
  const [scheduleAt, setScheduleAt] = useState('');
  const inputRef = useRef(null);

  const loadConnections = async () => {
    setLoadingConnections(true);
    try {
      const response = await fetch('/.netlify/functions/connections', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load connection status');
      setConnections(ACCOUNT_DEFINITIONS.map((definition) => {
        const live = data.connections?.find((item) => item.slot === definition.slot) || {};
        return { ...definition, ...live };
      }));
      setSelected((current) => {
        const connectedSlots = new Set((data.connections || []).filter((item) => item.connected).map((item) => item.slot));
        const stillValid = current.filter((slot) => connectedSlots.has(slot));
        return stillValid.length ? stillValid : [...connectedSlots];
      });
    } catch (error) {
      setNotice(`Connection service is not ready: ${error.message}`);
      setNoticeType('error');
    } finally {
      setLoadingConnections(false);
    }
  };

  useEffect(() => {
    loadConnections();
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('oauth');
    if (oauth === 'success') {
      setNotice('Authorization completed. Verifying the connected account…');
      setNoticeType('success');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (oauth === 'failed') {
      setNotice(`Authorization failed: ${params.get('reason') || 'the provider did not complete authorization.'}`);
      setNoticeType('error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const connectedCount = useMemo(() => connections.filter((item) => item.connected).length, [connections]);
  const selectedCount = selected.length;
  const composerUnlocked = connectedCount > 0;
  const allConnected = connectedCount === ACCOUNT_DEFINITIONS.length;

  const connectAccount = async (slot) => {
    setBusySlot(slot);
    setNotice('');
    try {
      const response = await fetch(`/.netlify/functions/oauth-start?slot=${encodeURIComponent(slot)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        if (data.missingEnvironment?.length) {
          throw new Error(`Netlify setup required: ${data.missingEnvironment.join(', ')}`);
        }
        throw new Error(data.error || 'Unable to start authorization');
      }
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setNotice(error.message);
      setNoticeType('error');
      setBusySlot('');
    }
  };

  const disconnectAccount = async (slot) => {
    setBusySlot(slot);
    try {
      const response = await fetch('/.netlify/functions/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to disconnect');
      setSelected((current) => current.filter((item) => item !== slot));
      setNotice('Account disconnected. Stored authorization was removed from this site.');
      setNoticeType('success');
      await loadConnections();
    } catch (error) {
      setNotice(error.message);
      setNoticeType('error');
    } finally {
      setBusySlot('');
    }
  };

  const selectFile = (nextFile) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('video/')) {
      setNotice('Please choose a video file.');
      setNoticeType('error');
      return;
    }
    setFile(nextFile);
    setNotice('');
  };

  const toggleDestination = (slot) => {
    const connection = connections.find((item) => item.slot === slot);
    if (!connection?.connected) return;
    setSelected((current) => current.includes(slot)
      ? current.filter((item) => item !== slot)
      : [...current, slot]);
  };

  const handlePublish = () => {
    if (!composerUnlocked) {
      setNotice('Connect and authorize at least one social account first.');
      setNoticeType('error');
      return;
    }
    if (!file) {
      setNotice('Choose the video you want to publish.');
      setNoticeType('error');
      return;
    }
    if (!selectedCount) {
      setNotice('Select at least one connected destination.');
      setNoticeType('error');
      return;
    }
    if (publishMode === 'schedule') {
      if (!scheduleAt || new Date(scheduleAt) <= new Date()) {
        setNotice('Choose a future date and time for the scheduled post.');
        setNoticeType('error');
        return;
      }
      setNotice('Scheduling UI is ready. The next backend stage will persist the video and run the publishing worker at this time; it is not pretending to schedule until durable media storage is connected.');
      setNoticeType('info');
      return;
    }
    setNotice('Your authorized destinations are ready for the publishing stage. The next backend stage will upload this file to each selected platform; no fake post was sent.');
    setNoticeType('info');
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="workspace">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark"><span>D</span><small>SP</small></div>
            <div><strong>Duke Social Publisher</strong><span>One upload · every channel</span></div>
          </div>
          <div className={`global-status ${allConnected ? 'complete' : ''}`}>
            <i /> {loadingConnections ? 'Checking accounts' : `${connectedCount}/5 accounts connected`}
          </div>
        </header>

        <section className="hero">
          <span className="eyebrow">Connection-first workflow</span>
          <h1>Authorize first.<br /><span>Publish with confidence.</span></h1>
          <p>No account is marked connected until its provider completes OAuth and the server verifies the account.</p>
        </section>

        {notice && <div className={`notice ${noticeType}`} role="status">{notice}</div>}

        <section className="step-section">
          <div className="step-heading">
            <div className="step-number">1</div>
            <div><span>Accounts</span><h2>Connect your five destinations</h2><p>Authorize each account separately. Tokens stay server-side and are encrypted before storage.</p></div>
          </div>

          <div className="account-grid">
            {connections.map((item) => {
              const checking = item.configured === null;
              const setupRequired = item.configured === false;
              const statusText = item.connected ? 'Connected' : setupRequired ? 'Setup required' : checking ? 'Checking' : 'Not connected';
              return (
                <article className={`account-card ${item.connected ? 'is-connected' : ''}`} key={item.slot}>
                  <div className="account-main">
                    <span className={`platform-badge ${item.tone}`}>{item.badge}</span>
                    <div className="account-copy">
                      <strong>{item.label}</strong>
                      <span>{item.connected ? item.account?.displayName : item.note}</span>
                    </div>
                    <span className={`account-status ${item.connected ? 'ok' : setupRequired ? 'setup' : ''}`}><i />{statusText}</span>
                  </div>

                  <div className="scope-row">
                    <span>Requested access</span>
                    <div>{item.scopes.map((scope) => <code key={scope}>{scope}</code>)}</div>
                  </div>

                  {setupRequired && (
                    <div className="setup-warning">Missing on Netlify: {item.missingEnvironment?.join(', ')}</div>
                  )}
                  {item.lastError && <div className="setup-warning error-copy">Last failure: {item.lastError}</div>}

                  <div className="account-actions">
                    {item.connected ? (
                      <>
                        <div className="verified-copy"><span>✓</span> OAuth verified</div>
                        <button type="button" className="text-button" disabled={busySlot === item.slot} onClick={() => disconnectAccount(item.slot)}>Disconnect</button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="connect-button"
                        disabled={checking || setupRequired || busySlot === item.slot}
                        onClick={() => connectAccount(item.slot)}
                      >
                        {busySlot === item.slot ? 'Opening authorization…' : setupRequired ? 'Add API credentials first' : `Connect ${item.platform}`}
                        <span>↗</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={`step-section composer-section ${composerUnlocked ? '' : 'locked'}`}>
          <div className="step-heading">
            <div className="step-number">2</div>
            <div><span>Composer</span><h2>Create one post for every connected account</h2><p>{composerUnlocked ? 'Choose a video, select destinations, then publish now or schedule it.' : 'This composer unlocks after the first real OAuth connection succeeds.'}</p></div>
          </div>

          {!composerUnlocked && <div className="locked-banner"><span>🔒</span><div><strong>Connect an account to continue</strong><p>Nothing can be posted while every destination is unauthorized.</p></div></div>}

          <div className="composer-grid" aria-disabled={!composerUnlocked}>
            <div className="composer-left">
              <button
                type="button"
                className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                disabled={!composerUnlocked}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => { if (composerUnlocked) { event.preventDefault(); setDragging(true); } }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  if (!composerUnlocked) return;
                  event.preventDefault();
                  setDragging(false);
                  selectFile(event.dataTransfer.files?.[0]);
                }}
              >
                <input ref={inputRef} type="file" accept="video/*" hidden onChange={(event) => selectFile(event.target.files?.[0])} />
                <div className="upload-icon"><CloudIcon /></div>
                {file ? <><strong>{file.name}</strong><span>{formatBytes(file.size)} · selected</span><em>Click to replace video</em></> : <><strong>Drop your video here</strong><span>or click to browse from your device</span><em>MP4 / MOV recommended for cross-platform posting</em></>}
              </button>

              <label className="field-label" htmlFor="caption">Caption</label>
              <div className="caption-box">
                <textarea id="caption" disabled={!composerUnlocked} value={caption} maxLength={2200} onChange={(event) => setCaption(event.target.value)} placeholder="Write your caption and hashtags…" />
                <div className="caption-footer"><span>One caption · platform-specific refinement comes next</span><b>{caption.length}/2200</b></div>
              </div>
            </div>

            <aside className="composer-right">
              <div className="destination-heading"><div><span>Destinations</span><h3>Connected accounts</h3></div><b>{selectedCount}/{connectedCount}</b></div>
              <div className="destination-list">
                {connections.map((item) => (
                  <button type="button" key={item.slot} className={`destination ${selected.includes(item.slot) ? 'selected' : ''} ${item.connected ? '' : 'disabled'}`} disabled={!item.connected} onClick={() => toggleDestination(item.slot)}>
                    <span className={`platform-badge small ${item.tone}`}>{item.badge}</span>
                    <span><strong>{item.platform}</strong><small>{item.connected ? item.account?.displayName : 'Not connected'}</small></span>
                    <i>{selected.includes(item.slot) ? '✓' : item.connected ? '' : '—'}</i>
                  </button>
                ))}
              </div>

              <div className="timing-card">
                <span className="field-label timing-label">When should this go live?</span>
                <div className="mode-toggle">
                  <button type="button" disabled={!composerUnlocked} className={publishMode === 'now' ? 'active' : ''} onClick={() => setPublishMode('now')}>Post now</button>
                  <button type="button" disabled={!composerUnlocked} className={publishMode === 'schedule' ? 'active' : ''} onClick={() => setPublishMode('schedule')}>Schedule</button>
                </div>

                {publishMode === 'schedule' && (
                  <div className="schedule-controls">
                    <input type="datetime-local" min={localDateTimeValue(new Date())} value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
                    <div className="preset-row">
                      <button type="button" onClick={() => setScheduleAt(presetDate('evening'))}>This evening</button>
                      <button type="button" onClick={() => setScheduleAt(presetDate('tomorrow'))}>Tomorrow</button>
                      <button type="button" onClick={() => setScheduleAt(presetDate('day-after'))}>Day after</button>
                    </div>
                    <p>Scheduled posts will be kept server-side so they can publish even when your browser is closed.</p>
                  </div>
                )}
              </div>
            </aside>
          </div>

          <footer className="composer-footer">
            <div><span>{publishMode === 'now' ? 'Ready to publish' : 'Ready to schedule'}</span><strong>{selectedCount} selected destination{selectedCount === 1 ? '' : 's'}</strong></div>
            <button type="button" className="publish-button" disabled={!composerUnlocked} onClick={handlePublish}>
              <span>{publishMode === 'now' ? 'Publish Everywhere' : 'Schedule Post'}</span><b>{publishMode === 'now' ? '↗' : '◷'}</b>
            </button>
          </footer>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
