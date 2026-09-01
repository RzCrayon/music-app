import { useEffect, useRef, useState, type ReactElement } from "react";
import './DraggableScroll.css'

export function DraggableScroll({
  content,
  zoomAmnt,
  scaleUpAnimDur,
}: {
  content: ReactElement<any, any>
  zoomAmnt: number,
  scaleUpAnimDur: number
}) {

  const containerRef = useRef<HTMLDivElement>(null);

  const [isDown, setIsDown] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ left: 0, top: 0 });
  const [canScroll, setCanScroll] = useState({ x: false, y: false });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDown(true);
    setStartPos({
      x: e.pageX - containerRef.current.offsetLeft,
      y: e.pageY - containerRef.current.offsetTop,
    });
    setScrollPos({
      left: containerRef.current.scrollLeft,
      top: containerRef.current.scrollTop,
    });
  };

  const handleMouseLeaveOrUp = () => {
    setIsDown(false);
  };

  useEffect(() => {

    const timer = setTimeout(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const target = container.children[0] as HTMLElement;
      if (!target) return;

      const targetRect = target.getBoundingClientRect();

      const hasXScroll = targetRect.width > container.clientWidth;
      const hasYScroll = targetRect.height > container.clientHeight;
      setCanScroll({ x: hasXScroll, y: hasYScroll });
    }, scaleUpAnimDur);

    return () => clearTimeout(timer);
  }, [zoomAmnt]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !containerRef.current) return;
    e.preventDefault();

    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startPos.x) * 2;
    const walkY = (y - startPos.y) * 2

    containerRef.current.scrollLeft = scrollPos.left - walkX;
    containerRef.current.scrollTop = scrollPos.top - walkY
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeaveOrUp}
      onMouseUp={handleMouseLeaveOrUp}
      onMouseMove={handleMouseMove}
      className="scroll-container"
      style={{
        cursor: (() => {
          if (canScroll.x && !canScroll.y) return 'ew-resize';
          if (canScroll.y && !canScroll.x) return 'ns-resize';
          if (canScroll.x && canScroll.y) return 'all-scroll'
          return 'default';
        })()
      }}
    >
      {content}
    </div>
  );
}