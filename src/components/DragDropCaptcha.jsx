// src/components/DragDropCaptcha.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { fetchChallenge, verifyChallenge, normalizeBase64 } from "../api";

/* Icons */
const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9" />
    <path d="M3 12a9 9 0 0 0 9 9" />
    <path d="M21 3v6h-6" />
    <path d="M3 21v-6h6" />
  </svg>
);

const RotateIcon = () => (
  <svg width="800px" height="800px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path fill="#000000" d="M14.9547098,7.98576084 L15.0711,7.99552 C15.6179,8.07328 15.9981,8.57957 15.9204,9.12636 C15.6826,10.7983 14.9218,12.3522 13.747,13.5654 C12.5721,14.7785 11.0435,15.5888 9.37999,15.8801 C7.7165,16.1714 6.00349,15.9288 4.48631,15.187 C3.77335,14.8385 3.12082,14.3881 2.5472,13.8537 L1.70711,14.6938 C1.07714,15.3238 3.55271368e-15,14.8776 3.55271368e-15,13.9867 L3.55271368e-15,9.99998 L3.98673,9.99998 C4.87763,9.99998 5.3238,11.0771 4.69383,11.7071 L3.9626,12.4383 C4.38006,12.8181 4.85153,13.1394 5.36475,13.3903 C6.50264,13.9466 7.78739,14.1285 9.03501,13.9101 C10.2826,13.6916 11.4291,13.0839 12.3102,12.174 C13.1914,11.2641 13.762,10.0988 13.9403,8.84476 C14.0181,8.29798 14.5244,7.91776 15.0711,7.99552 L14.9547098,7.98576084 Z M11.5137,0.812976 C12.2279,1.16215 12.8814,1.61349 13.4558,2.14905 L14.2929,1.31193 C14.9229,0.681961 16,1.12813 16,2.01904 L16,6.00001 L12.019,6.00001 C11.1281,6.00001 10.6819,4.92287 11.3119,4.29291 L12.0404,3.56441 C11.6222,3.18346 11.1497,2.86125 10.6353,2.60973 C9.49736,2.05342 8.21261,1.87146 6.96499,2.08994 C5.71737,2.30841 4.57089,2.91611 3.68976,3.82599 C2.80862,4.73586 2.23802,5.90125 2.05969,7.15524 C1.98193,7.70202 1.47564,8.08224 0.928858,8.00448 C0.382075,7.92672 0.00185585,7.42043 0.0796146,6.87364 C0.31739,5.20166 1.07818,3.64782 2.25303,2.43465 C3.42788,1.22148 4.95652,0.411217 6.62001,0.119916 C8.2835,-0.171384 9.99651,0.0712178 11.5137,0.812976 Z"/>
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

const degForTurns = (turns) => (turns % 4) * 90;

export default function DragDropCaptcha() {
  const [challenge, setChallenge] = useState(null);
  const [tiles, setTiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [error, setError] = useState(null);
  const [stateToken, setStateToken] = useState(null);

  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const dragRef = useRef({
    active: false,
    tileId: null,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    wrapperEl: null,
    imgEl: null,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
  });

  const mouseMovements = useRef([]);

  const loadChallenge = async (tokenToSend = null) => {
    setLoading(true);
    setError(null);
    setStatus("idle");
    setStatusMessage("Ready");

    try {
      const data = await fetchChallenge(tokenToSend);

      if (data && data.challengeId != null) {
        data.challengeId = String(data.challengeId);
      }

      if (data?.stateToken || data?.state_token) {
        setStateToken(data.stateToken ?? data.state_token);
      }

      const processed = (data.tiles || []).map((t, idx) => {
        const tid = t.tileId ?? t.holeIndex ?? idx;
        const turns =
          typeof t.turns === "number"
            ? t.turns
            : typeof t.turn === "number"
            ? t.turn
            : 0;

        return {
          tileId: String(tid),
          image: t.image ?? "",
          cutout: t.cutout ?? { x: 0, y: 0, width: 72, height: 72 },
          x: 12,
          y: 12 + idx * ((t.cutout?.height || 72) + 12),
          width: t.cutout?.width || 72,
          height: t.cutout?.height || 72,
          turns,
        };
      });

      setChallenge(data);
      setTiles(processed);
      setTimeout(() => drawOverlay(data), 60);
    } catch (err) {
      console.error("loadChallenge", err);
      setError("Failed to load challenge");
    } finally {
      setLoading(false);
      mouseMovements.current = [];
    }
  };

  useEffect(() => {
    loadChallenge();
    
  }, []);
  const drawOverlay = (data = challenge) => {
    if (!data) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const width = data.imageWidth ?? img.naturalWidth ?? 400;
    const height = data.imageHeight ?? img.naturalHeight ?? 340;
    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    (data.tiles || []).forEach(tile => {
      const c = tile.cutout;
      if (!c) return;
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.fillRect(c.x, c.y, c.width, c.height);
      const g = ctx.createLinearGradient(c.x, c.y, c.x + c.width, c.y + c.height);
      g.addColorStop(0, "rgba(79,70,229,0.85)");
      g.addColorStop(1, "rgba(16,185,129,0.65)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.width - 1, c.height - 1);
    });
  };


  const onImageLoad = () => drawOverlay();

  const onPointerDown = (e, tileId) => {
    if (verifying) return;
    const imgEl = e.currentTarget;
    const wrapperEl = imgEl.closest(".tile-wrapper");
    if (!wrapperEl) return;
    const tile = tiles.find(t => t.tileId === String(tileId));
    if (!tile) return;

    e.stopPropagation();
    imgEl.setPointerCapture?.(e.pointerId);

    const wrapperRect = wrapperEl.getBoundingClientRect();
    const offsetX = e.clientX - wrapperRect.left;
    const offsetY = e.clientY - wrapperRect.top;

    dragRef.current = {
      active: true,
      tileId: String(tileId),
      startX: e.clientX,
      startY: e.clientY,
      initialX: tile.x,
      initialY: tile.y,
      wrapperEl,
      imgEl,
      pointerOffsetX: offsetX,
      pointerOffsetY: offsetY,
    };

    wrapperEl.style.willChange = "transform";
    wrapperEl.classList.add("dragging");
  };

  const onPointerMove = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseMovements.current.push({
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
        t: Date.now()
      });
    }

    if (!dragRef.current.active) return;
    const { wrapperEl, tileId, initialX, initialY, pointerOffsetX, pointerOffsetY } = dragRef.current;
    const imgEl = imgRef.current;
    if (!wrapperEl || !imgEl) return;

    const imgRect = imgEl.getBoundingClientRect();
    let desiredX = e.clientX - imgRect.left - pointerOffsetX;
    let desiredY = e.clientY - imgRect.top - pointerOffsetY;

    const tile = tiles.find(t => t.tileId === String(tileId));
    if (tile && challenge) {
      desiredX = Math.max(0, Math.min(desiredX, challenge.imageWidth - tile.width));
      desiredY = Math.max(0, Math.min(desiredY, challenge.imageHeight - tile.height));
    }

    const dx = desiredX - initialX;
    const dy = desiredY - initialY;
    wrapperEl.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const onPointerUp = (e) => {
    if (!dragRef.current.active) return;
    const { wrapperEl, tileId, pointerOffsetX, pointerOffsetY } = dragRef.current;
    const imgEl = imgRef.current;
    if (!wrapperEl || !imgEl) return;

    const imgRect = imgEl.getBoundingClientRect();
    let finalX = Math.round(e.clientX - imgRect.left - pointerOffsetX);
    let finalY = Math.round(e.clientY - imgRect.top - pointerOffsetY);

    const tile = tiles.find(t => t.tileId === String(tileId));
    if (tile && challenge) {
      finalX = Math.max(0, Math.min(finalX, challenge.imageWidth - tile.width));
      finalY = Math.max(0, Math.min(finalY, challenge.imageHeight - tile.height));
    }

    wrapperEl.style.left = finalX + "px";
    wrapperEl.style.top = finalY + "px";
    wrapperEl.style.transform = "";

    setTiles(prev => prev.map(t => t.tileId === String(tileId) ? { ...t, x: finalX, y: finalY } : t));

    wrapperEl.style.willChange = "";
    wrapperEl.classList.remove("dragging");
    dragRef.current = { active: false, tileId: null, startX:0, startY:0, initialX:0, initialY:0, wrapperEl:null, imgEl:null, pointerOffsetX:0, pointerOffsetY:0 };
  };

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [tiles, challenge]);

  const rotateTile = (tileId, e) => {
    e?.stopPropagation();
    setTiles(prev => prev.map(t => t.tileId === String(tileId) ? { ...t, turns: (t.turns + 1) % 4 } : t));
  };

  const buildVerifyPayloadFromDOM = () => {
    const imgEl = imgRef.current;
    if (!imgEl) return tiles.map(t => ({ tileId: t.tileId, x: t.x, y: t.y, turn: t.turns }));
    const imgRect = imgEl.getBoundingClientRect();
    return tiles.map(t => {
      const wrapper = document.querySelector(`.tile-wrapper[data-tile-id="${CSS.escape(t.tileId)}"]`);
      if (!wrapper) return { tileId: t.tileId, x: t.x, y: t.y, turn: t.turns };
      const wRect = wrapper.getBoundingClientRect();
      let x = Math.round(wRect.left - imgRect.left);
      let y = Math.round(wRect.top - imgRect.top);
      if (challenge) {
        x = Math.max(0, Math.min(x, challenge.imageWidth - wrapper.offsetWidth));
        y = Math.max(0, Math.min(y, challenge.imageHeight - wrapper.offsetHeight));
      }
      return { tileId: t.tileId, x, y, turn: t.turns };
    });
  };

  const handleVerify = async () => {
    if (!challenge) return;
    setVerifying(true);
    setStatusMessage("Verifying...");

    const payloadTiles = buildVerifyPayloadFromDOM();
    const payload = {
      challengeId: challenge.challengeId,
      tiles: payloadTiles,
      mouse: {
        viewportWidth: containerRef.current?.offsetWidth || 0,
        viewportHeight: containerRef.current?.offsetHeight || 0,
        events: mouseMovements.current
      }
    };

    try {
      const res = await verifyChallenge(
        payload.challengeId,
        payload.tiles,
        payload.mouse,
        stateToken
      );

      const result =
        res?.result ??
        res?.status ??
        (res?.success === true ? "pass" : "fail");

      const verifyStateToken = res?.stateToken ?? res?.state_token ?? stateToken;
      if (verifyStateToken) {
        setStateToken(verifyStateToken);
      }

      if (result === "pass") {
        setStatus("success");
        setStatusMessage("Verified (pass)");
      } else if (result === "fail") {
        setStatus("failure");
        setStatusMessage("Verification failed");
      } else {
        setStatus("cant-say");
        setStatusMessage("Can't determine");

        setTimeout(() => {
          setVerifying(false);
          if (verifyStateToken) {
            loadChallenge(verifyStateToken);
          } else {
            loadChallenge();
          }
        }, 1400);

        return;
      }
    } catch (err) {
      console.error(err);
      setStatus("failure");
      setStatusMessage("Network error");
    } finally {
      setTimeout(() => {
        setVerifying(false);
      }, 1400);
    }
  };

  const bgSrc = challenge ? normalizeBase64(challenge.baseImage) : "";

  return (
    <div
      className="captcha-card"
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        padding: 24,
        gap: 32,
      }}
    >
      {/* LEFT: image + 7px padding outside stage */}
      <div
        ref={containerRef}
        style={{
          flex: "0 0 auto",
          padding: 0, 
          borderRadius: 16,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        {challenge && (
          <div
            className="captcha-stage"
            style={{
              position: "relative",
              width: challenge.imageWidth ?? 400,
              height: challenge.imageHeight ?? 340,
              overflow: "hidden",
              boxSizing: "content-box",
            }}
          >
            {loading && <div className="skeleton-loader" />}
            <img
              ref={imgRef}
              src={bgSrc}
              alt="captcha background"
              onLoad={onImageLoad}
              width={challenge.imageWidth}
              height={challenge.imageHeight}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: challenge.imageWidth,
                height: challenge.imageHeight,
                objectFit: "cover",
                pointerEvents: "none",
                display: "block",
              }}
            />
            <canvas
              ref={canvasRef}
              className="captcha-overlay-canvas"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
              }}
            />
            {tiles.map((t) => {
              const deg = degForTurns(t.turns);
              return (
                <div
                  key={t.tileId}
                  className="tile-wrapper"
                  data-tile-id={t.tileId}
                  style={{
                    position: "absolute",
                    left: t.x,
                    top: t.y,
                    width: t.width,
                    height: t.height,
                    zIndex: 30,
                  }}
                >
                  <img
                    data-tile-id={t.tileId}
                    src={normalizeBase64(t.image)}
                    alt="tile"
                    onPointerDown={(e) => onPointerDown(e, t.tileId)}
                    draggable={false}
                    style={{
                      width: t.width,
                      height: t.height,
                      transform: `rotate(${deg}deg)`,
                      transformOrigin: "50% 50%",
                      display: "block",
                      borderRadius: 8,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => rotateTile(t.tileId, e)}
                    style={{
                      position: "absolute",
                      right: 6,
                      top: 6,
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: "none",
                      background: "transparent",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      zIndex: 40,
                    }}
                  >
                    <RotateIcon />
                  </button>
                </div>
              );
            })}
            {status !== "idle" && (
              <div
                className="result-overlay"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.6)",
                  zIndex: 50,
                }}
              >
                <div
                  className="result-content"
                  style={{ textAlign: "center" }}
                >
                  {status === "success" && (
                    <>
                      <CheckCircleIcon />
                      <div className="result-message success">
                        {statusMessage}
                      </div>
                    </>
                  )}
                  {status === "failure" && (
                    <>
                      <XCircleIcon />
                      <div className="result-message error">
                        {statusMessage}
                      </div>
                    </>
                  )}
                  {status === "cant-say" && (
                    <>
                      <svg
                        width="80"
                        height="80"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <circle cx="12" cy="16" r="1" />
                      </svg>
                      <div className="result-message neutral">
                        {statusMessage}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: panel */}
      <div className="captcha-panel">
        <div className="panel-header">
          <div>
            <ShieldIcon />
            <h1 className="brand-title">Humanity Guard</h1>
          </div>
          <div className="brand-subtitle">Security Verification</div>
        </div>
        <div className="instructions">
          Drag each tile to the matching cutout, rotate as needed, then press
          Verify.
        </div>
        <div className="status-display">
          <span>Status:</span>
          <span className={`status-text ${status}`}>{statusMessage}</span>
        </div>
        {error && (
          <div style={{ color: "var(--error-color)" }}>{error}</div>
        )}
        <div className="panel-actions">
          <button
            className="btn btn-verify"
            onClick={handleVerify}
            disabled={loading || verifying}
          >
            {verifying ? "Verifying..." : "Verify Identity"}
          </button>
          <button
            className="btn btn-refresh"
            onClick={() => loadChallenge()}
            disabled={loading || verifying}
          >
            <RefreshIcon /> Refresh Challenge
          </button>
        </div>
      </div>
    </div>
  );
}