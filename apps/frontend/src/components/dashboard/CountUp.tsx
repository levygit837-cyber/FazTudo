import React, { useState, useEffect, useRef, useCallback } from "react";

export interface CountUpProps {
  end: number;
  start?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  formatter?: (value: number) => string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export const CountUp: React.FC<CountUpProps> = ({
  end,
  start = 0,
  duration = 800,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
  formatter,
}) => {
  const [display, setDisplay] = useState(start);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const formatValue = useCallback(
    (val: number) => {
      if (formatter) return formatter(val);
      return val.toFixed(decimals);
    },
    [formatter, decimals],
  );

  useEffect(() => {
    startTimeRef.current = 0;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = start + (end - start) * easedProgress;

      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(end);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, start, duration]);

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {prefix}
      {formatValue(display)}
      {suffix}
    </span>
  );
};

export default CountUp;
