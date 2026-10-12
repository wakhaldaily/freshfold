import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Renders fixed-width content (e.g. an A4-style invoice) at its natural width and
 * scales it down to fit narrow screens, like a print preview. On wide screens it
 * renders at 100% with no transform.
 */
export default function ScaledToFit({ width, children, className = '' }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(undefined);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => {
      const available = outer.clientWidth;
      const next = available > 0 && available < width ? available / width : 1;
      setScale(next);
      setHeight(next < 1 ? inner.offsetHeight * next : undefined);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);

  const scaled = scale < 1;
  return (
    <div ref={outerRef} className={className} data-fit-scale={scale} style={{ width: '100%', height, overflow: scaled ? 'hidden' : undefined }}>
      <div
        ref={innerRef}
        style={scaled ? { width: `${width}px`, transform: `scale(${scale})`, transformOrigin: 'top left' } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
