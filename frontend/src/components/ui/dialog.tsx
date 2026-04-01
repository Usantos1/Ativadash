import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
    title?: string;
    /** Texto para Radix `Description` (acessibilidade). */
    description?: React.ReactNode;
    /** Se true, `description` fica só para leitores de tela. */
    descriptionSrOnly?: boolean;
    /** Classes do backdrop (ex.: `bg-black/70 backdrop-blur-sm`). */
    overlayClassName?: string;
    /**
     * Alinha o modal ao topo da viewport (recomendado para formulários longos).
     * Evita cortar o conteúdo quando `translate-y-1/2` centraliza um painel alto.
     */
    alignTop?: boolean;
    /**
     * Centralização com `flex` no overlay (melhor em viewports baixas que só translate).
     * Backdrop padrão: `bg-black/50 backdrop-blur-sm`.
     */
    centered?: boolean;
  }
>(({ className, children, showClose = true, title, description, descriptionSrOnly = false, alignTop = false, centered = false, overlayClassName, ...props }, ref) => {
  const overlayMerged = cn(
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
    centered ? "bg-black/50 backdrop-blur-sm" : undefined,
    overlayClassName
  );

  const descNode =
    description != null ? (
      <DialogPrimitive.Description
        className={cn(
          "text-sm text-muted-foreground",
          descriptionSrOnly && "sr-only"
        )}
      >
        {description}
      </DialogPrimitive.Description>
    ) : typeof title === "string" && title.trim().length > 0 ? (
      <DialogPrimitive.Description className="sr-only">
        {`Diálogo: ${title}. Revise o conteúdo e confirme ou cancele.`}
      </DialogPrimitive.Description>
    ) : null;

  const inner = (
    <>
      {(title || showClose) && (
        <div className={cn("flex shrink-0 items-start gap-2", alignTop && "pr-1")}>
          {title && (
            <DialogPrimitive.Title className="min-w-0 flex-1 text-lg font-semibold leading-snug">
              {title}
            </DialogPrimitive.Title>
          )}
          {showClose && (
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="ml-auto shrink-0" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          )}
        </div>
      )}
      {descNode}
      {children}
    </>
  );

  if (centered) {
    return (
      <DialogPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <DialogPrimitive.Overlay className={cn("fixed inset-0 z-50", overlayMerged)} />
          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              "relative z-[60] grid w-full max-h-[min(100dvh-2rem,44rem)] max-w-lg gap-4 overflow-y-auto overflow-x-hidden rounded-xl border bg-background p-4 shadow-2xl duration-200 sm:max-w-xl sm:p-6",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              className
            )}
            {...props}
          >
            {inner}
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    );
  }

  return (
    <DialogPortal>
      <DialogOverlay className={overlayMerged} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-1/2 z-50 w-[min(100vw-1.5rem,32rem)] max-w-lg -translate-x-1/2 gap-4 rounded-lg border bg-background p-4 shadow-lg duration-200 sm:p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          alignTop
            ? "top-4 max-h-[calc(100dvh-2rem)] translate-y-0 overflow-x-hidden overflow-y-hidden data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-2"
            : "top-1/2 grid max-h-[min(100dvh-1rem,100vh-1rem)] -translate-y-1/2 overflow-y-auto overflow-x-hidden data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        {...props}
      >
        {inner}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
