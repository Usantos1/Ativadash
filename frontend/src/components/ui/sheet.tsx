import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    title: string;
    /** Descrição para leitores de tela (conteúdo visível fica no corpo). */
    description?: string;
  }
>(({ className, children, title, description, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-[min(100vw,26rem)] flex-col border-l border-border/35 bg-background shadow-[0_0_40px_-12px_rgba(0,0,0,0.25)] duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right dark:shadow-[0_0_48px_-12px_rgba(0,0,0,0.5)]",
        className
      )}
      {...props}
    >
      {description ? <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description> : null}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/35 px-5 py-4">
        <DialogPrimitive.Title className="text-base font-semibold tracking-tight text-foreground">{title}</DialogPrimitive.Title>
        <SheetClose asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-lg" aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </SheetClose>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

export { Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent };
