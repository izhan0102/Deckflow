"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Smooth count-up that runs once when the element enters the viewport.
 * Easing is a cubic-out so it lands gracefully.
 */
export default function Counter({
  value, duration = 1400, format = (n) => n.toLocaleString(), prefix = "", suffix = "",
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let started = false;
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !started) {
          started = true;
          const startTs = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - startTs) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setN(Math.round(eased * value));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.unobserve(node);
        }
      }
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{prefix}{format(n)}{suffix}</span>;
}
