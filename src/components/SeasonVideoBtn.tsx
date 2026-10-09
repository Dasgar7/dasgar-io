import React, { useRef, useEffect, useState } from 'react';

interface SeasonVideoBtnProps {
  className?: string;
  onClick?: () => void;
}

/**
 * Animated Season Button component
 * Displays the user's updated animated video with hardware-accelerated alpha masking
 * so the background is completely transparent, perfectly stable, and without performance bottlenecks.
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

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Canvas resolution matching season-button.png (1836 x 1088 -> 459 x 272, ratio 1.6875)
    const cw = 459;
    const ch = 272;
    canvas.width = cw;
    canvas.height = ch;

    // Preload mask image
    const maskImg = new Image();
    maskImg.crossOrigin = 'anonymous';
    maskImg.src = '/season-button.png';

    let lastDrawTime = 0;
    const TARGET_FPS_INTERVAL = 1000 / 30; // 30 FPS smooth animation

    const render = (timestamp: number) => {
      if (isCancelled) return;
      animId = requestAnimationFrame(render);

      if (video.paused || video.ended || video.readyState < 2) return;
      if (timestamp - lastDrawTime < TARGET_FPS_INTERVAL) return;
      lastDrawTime = timestamp;

      // Only draw when mask image is fully loaded to prevent black frame flash
      if (!maskImg.complete || maskImg.naturalWidth <= 0) return;

      try {
        ctx.clearRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = 'source-over';
        // Map video frame to canvas
        ctx.drawImage(video, 0, 8, 720, 467, 0, 0, cw, ch);

        // Hardware-accelerated destination-in mask using the high-resolution button alpha channel
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskImg, 0, 0, cw, ch);
        ctx.globalCompositeOperation = 'source-over';

        if (!isVideoReadyRef.current) {
          isVideoReadyRef.current = true;
          setIsVideoReady(true);
        }
      } catch {
        // Fallback gracefully without breaking
      }
    };

    animId = requestAnimationFrame(render);

    const onPlaying = () => {
      // Ready state handled on successful masked render
    };

    video.addEventListener('playing', onPlaying);

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay policy prevented autoplay; static fallback remains visible
      });
    }

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      video.removeEventListener('playing', onPlaying);
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

      {/* Base static button: guarantees 100% stable positioning, instant load, and zero layout shift */}
      <img
        src="/season-button.png"
        alt="Season"
        style={{ imageRendering: '-webkit-optimize-contrast' as React.CSSProperties['imageRendering'] }}
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />

      {/* Hardware-accelerated canvas layer displaying masked animation seamlessly */}
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
