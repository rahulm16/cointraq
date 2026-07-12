"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { cn } from "@/lib/ui";

const ACTION_WIDTH = 80;
const OPEN_THRESHOLD = 40;

export type SwipeAction = {
  label: string;
  onClick: () => void;
  /** Tailwind classes for the action button background/text. */
  className?: string;
  icon?: React.ReactNode;
};

/**
 * Mobile swipe actions: drag right to reveal left action, drag left for right.
 * Disabled on hover-capable pointers (desktop keeps its own affordances).
 */
export function SwipeRow({
  children,
  leftAction,
  rightAction,
  className,
  contentClassName,
}: {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  className?: string;
  contentClassName?: string;
}) {
  const x = useMotionValue(0);
  const [open, setOpen] = useState<"left" | "right" | null>(null);
  const [touchUi, setTouchUi] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const leftReveal = useTransform(x, [0, ACTION_WIDTH * 0.35, ACTION_WIDTH], [0, 0, 1]);
  const rightReveal = useTransform(x, [-ACTION_WIDTH, -ACTION_WIDTH * 0.35, 0], [1, 0, 0]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setTouchUi(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    animate(x, 0, { type: "spring", stiffness: 420, damping: 36 });
    setOpen(null);
  }

  function snap(side: "left" | "right" | null) {
    const target = side === "left" ? ACTION_WIDTH : side === "right" ? -ACTION_WIDTH : 0;
    animate(x, target, { type: "spring", stiffness: 420, damping: 36 });
    setOpen(side);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    const offset = x.get();
    const vx = info.velocity.x;
    if (leftAction && (offset > OPEN_THRESHOLD || vx > 400)) {
      snap("left");
      return;
    }
    if (rightAction && (offset < -OPEN_THRESHOLD || vx < -400)) {
      snap("right");
      return;
    }
    snap(null);
  }

  function runAction(action: SwipeAction) {
    action.onClick();
    close();
  }

  if (!touchUi || (!leftAction && !rightAction)) {
    return <div className={className}>{children}</div>;
  }

  const min = rightAction ? -ACTION_WIDTH : 0;
  const max = leftAction ? ACTION_WIDTH : 0;

  return (
    <div ref={rootRef} className={cn("relative isolate overflow-hidden", className)}>
      {leftAction && (
        <motion.button
          type="button"
          aria-hidden={open !== "left"}
          tabIndex={open === "left" ? 0 : -1}
          style={{ opacity: leftReveal }}
          onClick={() => runAction(leftAction)}
          className={cn(
            "absolute inset-y-0 left-0 z-0 flex w-20 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-white active:scale-[0.98]",
            leftAction.className ?? "bg-primary",
          )}
        >
          {leftAction.icon}
          {leftAction.label}
        </motion.button>
      )}
      {rightAction && (
        <motion.button
          type="button"
          aria-hidden={open !== "right"}
          tabIndex={open === "right" ? 0 : -1}
          style={{ opacity: rightReveal }}
          onClick={() => runAction(rightAction)}
          className={cn(
            "absolute inset-y-0 right-0 z-0 flex w-20 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-white active:scale-[0.98]",
            rightAction.className ?? "bg-alert",
          )}
        >
          {rightAction.icon}
          {rightAction.label}
        </motion.button>
      )}

      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: min, right: max }}
        dragElastic={0.12}
        onDragEnd={onDragEnd}
        onPointerUp={() => {
          if (openRef.current) close();
        }}
        className={cn(
          "relative z-[1] w-full bg-surface touch-pan-y",
          open && "[&_*]:!pointer-events-none",
          contentClassName,
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
