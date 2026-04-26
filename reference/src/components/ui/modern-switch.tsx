import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

type SwitchSize = "sm" | "md" | "lg"

interface ModernSwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  size?: SwitchSize
  loading?: boolean
}

const sizeMap: Record<
  SwitchSize,
  { track: string; thumb: string; translateOn: string }
> = {
  sm: { track: "h-6 w-11", thumb: "h-5 w-5", translateOn: "translate-x-5" },
  md: { track: "h-7 w-14", thumb: "h-6 w-6", translateOn: "translate-x-7" },
  lg: { track: "h-9 w-16", thumb: "h-8 w-8", translateOn: "translate-x-8" },
}

const ModernSwitch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  ModernSwitchProps
>(({ className, size = "md", loading = false, disabled, ...props }, ref) => {
  const s = sizeMap[size]

  return (
    <SwitchPrimitives.Root
      ref={ref}
      aria-busy={loading ? "true" : "false"}
      disabled={disabled || loading}
      className={cn(
        "relative peer inline-flex shrink-0 items-center rounded-full border border-transparent",
        // Tamanho do trilho
        s.track,
        // Transições (respeita prefers-reduced-motion)
        "transition-all duration-300 ease-out motion-reduce:transition-none",
        // Cursor + estados
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        // Base OFF
        "bg-muted/80 dark:bg-zinc-800/80",
        // Hover OFF
        "hover:bg-muted dark:hover:bg-zinc-800",
        // ON gradient + glow
        "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-emerald-600",
        "data-[state=checked]:shadow-[0_10px_24px_-10px_rgba(16,185,129,0.55)]",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // Sombra interna suave
        "shadow-inner",
        className
      )}
      {...props}
    >
      {/* Glow interno quando ligado */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300",
          "motion-reduce:transition-none",
          "opacity-0 data-[state=checked]:opacity-100"
        )}
        style={{
          boxShadow:
            "inset 0 0 10px rgba(255,255,255,0.12), 0 0 20px rgba(16,185,129,0.45)",
        }}
      />

      {/* Thumb */}
      <SwitchPrimitives.Thumb
        className={cn(
          "relative z-10 grid place-items-center rounded-full bg-background shadow-md",
          // Tamanho do thumb
          s.thumb,
          // Posição
          "translate-x-1 data-[state=checked]:translate-x-1",
          `data-[state=checked]:${s.translateOn}`,
          // Transições (GPU)
          "transition-transform duration-300 ease-out will-change-transform transform-gpu motion-reduce:transition-none",
          // Realce ao ligar
          "data-[state=checked]:shadow-lg data-[state=checked]:shadow-emerald-500/20"
        )}
      >
        {loading ? (
          // Spinner mini
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        ) : (
          // Ponto sutil (ON/ OFF)
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              "bg-zinc-300 dark:bg-zinc-600",
              "data-[state=checked]:bg-emerald-600"
            )}
          />
        )}
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  )
})
ModernSwitch.displayName = "ModernSwitch"

export { ModernSwitch }
