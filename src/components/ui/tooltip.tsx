import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

const LONG_PRESS_MS = 800;

/**
 * Tooltip wrapper that also opens on mobile long-press (800ms).
 */
const Tooltip = ({ children, ...props }: TooltipPrimitive.TooltipProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipPrimitive.Root
      {...props}
      open={props.open ?? open}
      onOpenChange={(v) => {
        setOpen(v);
        props.onOpenChange?.(v);
      }}
      delayDuration={props.delayDuration ?? 200}
    >
      <TooltipLongPressContext.Provider value={{ open: props.open ?? open, setOpen }}>
        {children}
      </TooltipLongPressContext.Provider>
    </TooltipPrimitive.Root>
  );
};

const TooltipLongPressContext = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

/**
 * TooltipTrigger that adds long-press support on touch devices.
 */
const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ children, ...props }, ref) => {
  const { setOpen } = React.useContext(TooltipLongPressContext);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = React.useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    clearTimer();
    if (isLongPressRef.current) {
      e.preventDefault();
      // Auto close after 3s
      setTimeout(() => setOpen(false), 3000);
    }
  };

  const handleTouchMove = () => clearTimer();

  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      {...props}
      onTouchStart={(e) => {
        handleTouchStart(e);
        (props as any).onTouchStart?.(e);
      }}
      onTouchEnd={(e) => {
        handleTouchEnd(e);
        (props as any).onTouchEnd?.(e);
      }}
      onTouchMove={(e) => {
        handleTouchMove();
        (props as any).onTouchMove?.(e);
      }}
    >
      {children}
    </TooltipPrimitive.Trigger>
  );
});
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[200] overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
