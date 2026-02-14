import React, { useEffect, useState } from "react";
import clsx from "clsx";

interface PageTransitionProps {
  children: React.ReactNode;
  routeKey: string;
  className?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  routeKey,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);
    const frameId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [routeKey]);

  return (
    <div
      className={clsx(
        "page-transition",
        isVisible && "page-transition-visible",
        className,
      )}
    >
      {children}
    </div>
  );
};

export default PageTransition;
