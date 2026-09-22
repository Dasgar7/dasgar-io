import React, { useRef, useState } from 'react';

interface TouchSafeButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  onClick?: (e?: React.MouseEvent | React.TouchEvent) => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  id?: string;
  role?: string;
}

export const TouchSafeButton: React.FC<TouchSafeButtonProps> = ({
  onClick,
  className = '',
  style = {},
  children,
  id,
  role = 'button',
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  ...rest
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchHandled = useRef(false);
  const activeTouchId = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsPressed(true);
    onTouchStart?.(e);

    if (activeTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    activeTouchId.current = touch.identifier;
    touchStartPos.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsPressed(false);
    onTouchEnd?.(e);

    if (activeTouchId.current === null) return;
    let matched: React.Touch | null = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        matched = e.changedTouches[i];
        break;
      }
    }
    if (matched && touchStartPos.current) {
      const dx = Math.abs(matched.clientX - touchStartPos.current.x);
      const dy = Math.abs(matched.clientY - touchStartPos.current.y);
      const dt = Date.now() - touchStartPos.current.time;

      if (dx < 16 && dy < 16 && dt < 1000) {
        touchHandled.current = true;
        onClick?.(e);
        setTimeout(() => {
          touchHandled.current = false;
        }, 400);
      }
      activeTouchId.current = null;
      touchStartPos.current = null;
    }
  };

  const handleTouchCancel = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsPressed(false);
    onTouchCancel?.(e);

    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId.current) {
        activeTouchId.current = null;
        touchStartPos.current = null;
        break;
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPressed(true);
    onMouseDown?.(e);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPressed(false);
    onMouseUp?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPressed(false);
    onMouseLeave?.(e);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (touchHandled.current) {
      return;
    }
    onClick?.(e);
  };

  return (
    <div
      id={id}
      role={role}
      draggable={false}
      data-pressed={isPressed ? "true" : undefined}
      onDragStart={(e) => e.preventDefault()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`cursor-pointer select-none ${className}`}
      style={{
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'manipulation',
        ...style
      }}
      {...rest}
    >
      {children}
    </div>
  );
};