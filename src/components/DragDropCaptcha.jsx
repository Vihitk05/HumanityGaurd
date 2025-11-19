// src/components/DragDropCaptcha.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchChallenge, verifyChallenge, normalizeBase64 } from '../api';

const RefreshIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircleIcon = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export default function DragDropCaptcha() {
  const [challenge, setChallenge] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, success, failure, cant-say
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [error, setError] = useState(null);

  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const dragRef = useRef({
    active: false,
    tileId: null,
    startX: 0,
    startY: 0,
    initialTileX: 0,
    initialTileY: 0,
    el: null,
  });

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus('idle');
    setStatusMessage('Ready');

    try {
      const data = await fetchChallenge();
      const processedTiles = (data.tiles || []).map((tile, index) => ({
        ...tile,
        x: 10,
        y: 10 + index * 80,
        width: tile.cutout?.width || 72,
        height: tile.cutout?.height || 72,
      }));
      setChallenge(data);
      setTiles(processedTiles);
    } catch (err) {
      setError('Failed to load CAPTCHA. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  const handleImageLoad = () => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !challenge) return;
  
    const dpr = window.devicePixelRatio || 1;
    const width = challenge.imageWidth || img.naturalWidth;
    const height = challenge.imageHeight || img.naturalHeight;
  
    // Set canvas CSS size to match image
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  
    // Set canvas internal resolution (device pixels)
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
  
    // Draw tile cutout overlays
    challenge.tiles.forEach(tile => {
      if (!tile.cutout) return;
      const { x, y, width: w, height: h } = tile.cutout;
  
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(x, y, w, h);
  
      const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
      gradient.addColorStop(0, 'rgba(0, 212, 255, 0.6)');
      gradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 212, 255, 0.2)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
  
      ctx.shadowColor = 'rgba(0, 212, 255, 0.3)';
      ctx.shadowBlur = 12;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;
    });
  };
  

  // Smooth Drag Handlers
  const handlePointerDown = (e, tileId) => {
    if (status === 'success' || verifying) return;

    const tileEl = e.target;
    const tile = tiles.find(t => t.tileId === tileId);
    if (!tile) return;

    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);

    dragRef.current = {
      active: true,
      tileId,
      startX: e.clientX,
      startY: e.clientY,
      initialTileX: tile.x,
      initialTileY: tile.y,
      el: tileEl,
    };

    tileEl.classList.add('dragging');
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return;

    const { startX, startY, initialTileX, initialTileY, el, tileId } = dragRef.current;
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;

    const tile = tiles.find(t => t.tileId === tileId);
    if (tile && challenge) {
      dx = Math.max(-tile.x, Math.min(dx, challenge.imageWidth - tile.width - tile.x));
      dy = Math.max(-tile.y, Math.min(dy, challenge.imageHeight - tile.height - tile.y));
    }

    el.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const handlePointerUp = () => {
    if (!dragRef.current.active) return;
    const { tileId, el } = dragRef.current;

    const transform = el.style.transform;
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
    let dx = 0, dy = 0;
    if (match) { dx = parseFloat(match[1]); dy = parseFloat(match[2]); }

    setTiles(prev => prev.map(t => t.tileId === tileId ? { ...t, x: t.x + dx, y: t.y + dy } : t));

    el.style.transform = '';
    el.classList.remove('dragging');
    dragRef.current.active = false;
  };

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [challenge]);

  const handleVerify = async () => {
    if (!challenge) return;
  
    setVerifying(true);
    setStatusMessage('Verifying...');
  
    try {
      const payloadTiles = tiles.map(t => ({
        tileId: t.tileId,
        x: Math.round(t.x),
        y: Math.round(t.y)
      }));
  
      const result = await verifyChallenge(challenge.challengeId, payloadTiles);
  
      // Update status according to response
      if (result.success === true) {
        setStatus('success');
        setStatusMessage('Verification Successful');
      } else if (result.success === false) {
        setStatus('failure');
        setStatusMessage(result.message || 'Verification Failed');
      } else {
        setStatus('cant-say');
        setStatusMessage('Cannot Determine');
      }
    } catch (err) {
      setStatus('failure');
      setStatusMessage('Network Error');
    } finally {
      // Load a new challenge after 1.4s regardless of the outcome
      setTimeout(() => {
        loadChallenge();
        setVerifying(false);
      }, 1400);
    }
  };
  

  return (
    <div className="captcha-card">
      <div
        className="captcha-stage"
        ref={containerRef}
        style={{
          width: challenge ? challenge.imageWidth : 400,
          height: challenge ? challenge.imageHeight : 340
        }}
      >
        {loading && <div className="skeleton-loader" />}
        {challenge && (
          <>
            <img
              ref={imageRef}
              src={normalizeBase64(challenge.baseImage) || "/placeholder.svg"}
              alt="Security Challenge"
              className="captcha-bg-image"
              onLoad={handleImageLoad}
              width={challenge.imageWidth}
              height={challenge.imageHeight}
            />
            <canvas ref={canvasRef} className="captcha-overlay-canvas" />
            {tiles.map(tile => (
              <img
                key={tile.tileId}
                data-tile-id={tile.tileId}
                src={normalizeBase64(tile.image) || "/placeholder.svg"}
                alt="Puzzle Piece"
                className="captcha-tile"
                style={{ left: tile.x, top: tile.y, width: tile.width, height: tile.height }}
                onPointerDown={(e) => handlePointerDown(e, tile.tileId)}
                draggable={false}
              />
            ))}
          </>
        )}
        {status !== 'idle' && (
          <div className="result-overlay">
            <div className="result-content">
              {status === 'success' ? (
                <>
                  <CheckCircleIcon />
                  <div className="result-message">{statusMessage}</div>
                </>
              ) : (
                <>
                  <XCircleIcon />
                  <div className="result-message">{statusMessage}</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="captcha-panel">
        <div className="panel-header">
          <div>
            <ShieldIcon />
            <h1 className="brand-title">Humanity Guard</h1>
          </div>
          <div className="brand-subtitle">Security Verification</div>
        </div>

        <div className="instructions">
          Drag the puzzle pieces to their correct positions to verify you are human.
        </div>

        <div className="status-display">
          <span>Status:</span>
          <span className={`status-text ${status}`}>{statusMessage}</span>
        </div>

        {error && <div style={{ color: 'var(--error-color)', fontSize: '0.8rem', marginBottom: '10px' }}>{error}</div>}

        <div className="panel-actions">
          <button className="btn btn-verify" onClick={handleVerify} disabled={loading || verifying || status === 'success'}>
            {verifying ? 'Verifying...' : 'Verify Identity'}
          </button>
          <button className="btn btn-refresh" onClick={loadChallenge} disabled={loading || verifying}>
            <RefreshIcon />
            Refresh Challenge
          </button>
        </div>
      </div>
    </div>
  );
}
