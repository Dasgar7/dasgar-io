import React, { useRef, useEffect, useState } from 'react';

interface SeasonVideoBtnProps {
  className?: string;
  onClick?: () => void;
}

/**
 * Animated Season Button component
 * Perfectly matches the exact aspect ratio (1.6875 : 1) and bounding box of season-button.png
 * so the button size and position remain completely stable at the exact same spot,
 * while seamlessly playing the animated flame video loop.
 */
export function SeasonVideoBtn({ className = '', onClick }: SeasonVideoBtnProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animId: number;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Canvas resolution matching season-button.png (1836 x 1088 -> 459 x 272, ratio 1.6875)
    const cw = 459;
    const ch = 272;
    canvas.width = cw;
    canvas.height = ch;

    const isBg = new Uint8Array(cw * ch);
    const queue = new Int32Array(cw * ch * 2);

    let lastDrawTime = 0;
    const TARGET_FPS_INTERVAL = 1000 / 30; // Smooth 30fps

    const renderFrame = (timestamp: number) => {
      animId = requestAnimationFrame(renderFrame);

      if (video.paused || video.ended || video.readyState < 2) return;

      if (timestamp - lastDrawTime < TARGET_FPS_INTERVAL) return;
      lastDrawTime = timestamp;

      try {
        // Draw active video content (source crop: 0, 8, 720, 467) mapped to full canvas (0, 0, cw, ch)
        // This removes the 69px black bottom margin and aligns 1:1 with the static button
        ctx.drawImage(video, 0, 8, 720, 467, 0, 0, cw, ch);
        const imgData = ctx.getImageData(0, 0, cw, ch);
        const data = imgData.data;

        // Reset background map
        isBg.fill(0);
        let qLen = 0;

        // Seed borders (outer perimeter is dark background in AI video)
        for (let x = 0; x < cw; x++) {
          const topIdx = (0 * cw + x) * 4;
          if (Math.max(data[topIdx], data[topIdx + 1], data[topIdx + 2]) < 35) {
            isBg[x] = 1;
            queue[qLen++] = x;
            queue[qLen++] = 0;
          }
          const botIdx = ((ch - 1) * cw + x) * 4;
          if (Math.max(data[botIdx], data[botIdx + 1], data[botIdx + 2]) < 35) {
            isBg[(ch - 1) * cw + x] = 1;
            queue[qLen++] = x;
            queue[qLen++] = ch - 1;
          }
        }

        for (let y = 1; y < ch - 1; y++) {
          const leftIdx = (y * cw + 0) * 4;
          if (Math.max(data[leftIdx], data[leftIdx + 1], data[leftIdx + 2]) < 35) {
            isBg[y * cw] = 1;
            queue[qLen++] = 0;
            queue[qLen++] = y;
          }
          const rightIdx = (y * cw + (cw - 1)) * 4;
          if (Math.max(data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]) < 35) {
            isBg[y * cw + cw - 1] = 1;
            queue[qLen++] = cw - 1;
            queue[qLen++] = y;
          }
        }

        // Fast breadth-first flood fill inwards from perimeter
        let head = 0;
        while (head < qLen) {
          const cx = queue[head++];
          const cy = queue[head++];

          // 4 neighbors
          const up = (cy - 1) * cw + cx;
          if (cy > 0 && !isBg[up]) {
            const idx = up * 4;
            if (Math.max(data[idx], data[idx + 1], data[idx + 2]) < 28) {
              isBg[up] = 1;
              queue[qLen++] = cx;
              queue[qLen++] = cy - 1;
            }
          }

          const down = (cy + 1) * cw + cx;
          if (cy < ch - 1 && !isBg[down]) {
            const idx = down * 4;
            if (Math.max(data[idx], data[idx + 1], data[idx + 2]) < 28) {
              isBg[down] = 1;
              queue[qLen++] = cx;
              queue[qLen++] = cy + 1;
            }
          }

          const left = cy * cw + cx - 1;
          if (cx > 0 && !isBg[left]) {
            const idx = left * 4;
            if (Math.max(data[idx], data[idx + 1], data[idx + 2]) < 28) {
              isBg[left] = 1;
              queue[qLen++] = cx - 1;
              queue[qLen++] = cy;
            }
          }

          const right = cy * cw + cx + 1;
          if (cx < cw - 1 && !isBg[right]) {
            const idx = right * 4;
            if (Math.max(data[idx], data[idx + 1], data[idx + 2]) < 28) {
              isBg[right] = 1;
              queue[qLen++] = cx + 1;
              queue[qLen++] = cy;
            }
          }
        }

        // Apply alpha transparency only to outer background
        for (let y = 0; y < ch; y++) {
          const rowOffset = y * cw;
          for (let x = 0; x < cw; x++) {
            const mapIdx = rowOffset + x;
            if (isBg[mapIdx]) {
              data[mapIdx * 4 + 3] = 0;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        if (!isVideoReady) setIsVideoReady(true);
      } catch {
        // Fallback gracefully
      }
    };

    animId = requestAnimationFrame(renderFrame);

    const handlePlay = () => {
      setIsVideoReady(true);
    };

    video.addEventListener('playing', handlePlay);

    // Auto-play safely
    video.play().catch(() => {
      // Browser autoplay policy
    });

    return () => {
      cancelAnimationFrame(animId);
      video.removeEventListener('playing', handlePlay);
    };
  }, [isVideoReady]);

  return (
    <div 
      className={`relative w-full h-full flex items-center justify-end select-none drop-shadow-md hover:scale-105 active:scale-95 transition-transform ${className}`} 
      onClick={onClick}
    >
      {/* Hidden background video source */}
      <video
        ref={videoRef}
        src="/season-button.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="hidden"
      >
        <source src="/season-button.webm" type="video/webm" />
        <source src="/season-button.mp4" type="video/mp4" />
        <source src="/season-button.mov" type="video/quicktime" />
      </video>

      {/* Base static button: guarantees 100% exact size, position, and zero jumping */}
      <img
        src="/season-button.png"
        alt="Season"
        style={{ imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'] }}
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />

      {/* Live animated flame video layer matching exact same dimensions and coordinates */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity duration-300 ${
          isVideoReady ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'],
        }}
      />
    </div>
  );
}
