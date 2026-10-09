import React, { useRef, useEffect, useState } from 'react';

interface SeasonVideoBtnProps {
  className?: string;
  onClick?: () => void;
}

/**
 * Animated Season Button component
 * Displays the user's updated animated video with dynamic background transparency
 * so the "GOLD PASS" badge remains 100% visible and unclipped when rising/upping,
 * without black box background or size distortion.
 */
export function SeasonVideoBtn({ className = '', onClick }: SeasonVideoBtnProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const isVideoReadyRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animId: number;
    let isCancelled = false;

    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    if (!ctx) return;

    // High fidelity resolution matching video aspect ratio (720x544 -> 360x272)
    const cw = 360;
    const ch = 272;
    canvas.width = cw;
    canvas.height = ch;

    // Pre-allocated typed arrays to prevent GC pauses
    const isBg = new Uint8Array(cw * ch);
    const queue = new Int32Array(cw * ch * 2);

    let lastDrawTime = 0;
    const TARGET_FPS_INTERVAL = 1000 / 30; // 30 FPS smooth rendering

    const render = (timestamp: number) => {
      if (isCancelled) return;
      animId = requestAnimationFrame(render);

      if (video.paused || video.ended || video.readyState < 2) return;
      if (timestamp - lastDrawTime < TARGET_FPS_INTERVAL) return;
      lastDrawTime = timestamp;

      try {
        ctx.clearRect(0, 0, cw, ch);
        // Draw native video frame without any cropping or size changes
        ctx.drawImage(video, 0, 0, cw, ch);

        const imgData = ctx.getImageData(0, 0, cw, ch);
        const data = imgData.data;

        // Reset background map
        isBg.fill(0);
        let head = 0;
        let tail = 0;

        const BG_THRESH = 18;

        // Seed BFS from all borders
        for (let x = 0; x < cw; x++) {
          for (const y of [0, ch - 1]) {
            const p = (y * cw + x) * 4;
            if (Math.max(data[p], data[p + 1], data[p + 2]) <= BG_THRESH) {
              queue[tail++] = x;
              queue[tail++] = y;
              isBg[y * cw + x] = 1;
            }
          }
        }
        for (let y = 0; y < ch; y++) {
          for (const x of [0, cw - 1]) {
            const p = (y * cw + x) * 4;
            if (!isBg[y * cw + x] && Math.max(data[p], data[p + 1], data[p + 2]) <= BG_THRESH) {
              queue[tail++] = x;
              queue[tail++] = y;
              isBg[y * cw + x] = 1;
            }
          }
        }

        // BFS flood fill to isolate external black background without touching internal button details
        while (head < tail) {
          const x = queue[head++];
          const y = queue[head++];

          const neighbors = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1]
          ];

          for (let i = 0; i < 4; i++) {
            const nx = neighbors[i][0];
            const ny = neighbors[i][1];
            if (nx >= 0 && nx < cw && ny >= 0 && ny < ch) {
              const npos = ny * cw + nx;
              if (!isBg[npos]) {
                const p = npos * 4;
                if (Math.max(data[p], data[p + 1], data[p + 2]) <= BG_THRESH) {
                  isBg[npos] = 1;
                  queue[tail++] = nx;
                  queue[tail++] = ny;
                }
              }
            }
          }
        }

        // Clean alpha channel: remove background completely while keeping 100% of button interior solid & vibrant
        for (let i = 0; i < cw * ch; i++) {
          data[i * 4 + 3] = isBg[i] === 1 ? 0 : 255;
        }

        ctx.putImageData(imgData, 0, 0);

        if (!isVideoReadyRef.current) {
          isVideoReadyRef.current = true;
          setIsVideoReady(true);
        }
      } catch {
        // Fallback gracefully without throwing
      }
    };

    animId = requestAnimationFrame(render);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented autoplay; static poster remains visible
      });
    }

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div 
      className={`relative w-full h-full flex items-center justify-end select-none ${className}`} 
      onClick={onClick}
    >
      {/* Off-screen active video element */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          opacity: 0.001,
          pointerEvents: 'none',
          top: 0,
          left: 0,
        }}
      >
        <source src="/season-button.mp4" type="video/mp4" />
        <source src="/season-button.webm" type="video/webm" />
        <source src="/season-button.mov" type="video/quicktime" />
      </video>

      {/* Poster image: provides instant, stable presentation on initial load */}
      <img
        src="/season-button-poster.png"
        alt="Season"
        style={{ imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'] }}
        className={`w-full h-full object-contain pointer-events-none select-none transition-opacity duration-200 ${
          isVideoReady ? 'opacity-0' : 'opacity-100'
        }`}
        draggable={false}
      />

      {/* Dynamic transparent canvas layer: shows complete animation including rising GOLD PASS without clipping */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity duration-200 ${
          isVideoReady ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'],
        }}
      />
    </div>
  );
}
