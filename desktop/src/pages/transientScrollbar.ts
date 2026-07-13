import { useEffect, useRef, useState, type CSSProperties, type UIEventHandler } from 'react';

const SCROLLBAR_FADE_DELAY_MS = 700;
const CONTENT_EDGE_GAP = 38;
const THUMB_MIN_HEIGHT = 42;
const THUMB_EDGE_GAP = 4;

export function useTransientScrollbar() {
  const [isVisible, setIsVisible] = useState(false);
  const [thumbTop, setThumbTop] = useState(THUMB_EDGE_GAP);
  const [thumbHeight, setThumbHeight] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
    };
  }, []);

  const onScroll: UIEventHandler<HTMLDivElement> = (event) => {
    const scrollArea = event.currentTarget;
    const trackHeight = scrollArea.clientHeight - THUMB_EDGE_GAP * 2;
    const canScroll = scrollArea.scrollHeight > scrollArea.clientHeight;
    const nextThumbHeight = canScroll
      ? Math.max(THUMB_MIN_HEIGHT, trackHeight * scrollArea.clientHeight / scrollArea.scrollHeight)
      : 0;
    const scrollRange = scrollArea.scrollHeight - scrollArea.clientHeight;
    const thumbRange = trackHeight - nextThumbHeight;
    const nextThumbTop = canScroll && scrollRange > 0
      ? THUMB_EDGE_GAP + thumbRange * scrollArea.scrollTop / scrollRange
      : THUMB_EDGE_GAP;

    setThumbHeight(nextThumbHeight);
    setThumbTop(nextThumbTop);
    setIsVisible(canScroll);

    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
    }
    fadeTimerRef.current = window.setTimeout(() => {
      setIsVisible(false);
      fadeTimerRef.current = null;
    }, SCROLLBAR_FADE_DELAY_MS);
  };

  const canScroll = thumbHeight > 0;

  return {
    scrollAreaRef,
    onScroll,
    thumbStyle: {
      height: thumbHeight,
      opacity: isVisible && canScroll ? 1 : 0,
      transform: `translateY(${thumbTop}px)`,
    } satisfies CSSProperties,
  };
}

export const desktopPageFrameStyle: CSSProperties = {
  height: '100%',
  minWidth: 720,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  paddingRight: CONTENT_EDGE_GAP,
  position: 'relative',
};

export const desktopEdgeScrollAreaStyle: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  marginRight: -CONTENT_EDGE_GAP,
  paddingRight: CONTENT_EDGE_GAP,
  width: `calc(100% + ${CONTENT_EDGE_GAP}px)`,
};
