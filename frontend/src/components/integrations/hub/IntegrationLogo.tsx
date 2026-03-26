import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-11 w-11 [&_img]:h-7 [&_img]:w-7 p-2",
  md: "h-[4.25rem] w-[4.25rem] [&_img]:h-[2.65rem] [&_img]:w-[2.65rem] p-2.5",
  lg: "h-[5rem] w-[5rem] [&_img]:h-12 [&_img]:w-12 p-3",
} as const;

export type IntegrationLogoAccent =
  | "none"
  | "google"
  | "meta"
  | "tiktok"
  | "whatsapp"
  | "violet"
  | "indigo"
  | "ativa"
  | "slate"
  | "hotmart"
  | "kiwify"
  | "eduzz"
  | "braip"
  | "greenn";

type Props = {
  src: string;
  alt: string;
  size?: keyof typeof sizes;
  className?: string;
  accent?: IntegrationLogoAccent;
};

const accentRing: Record<IntegrationLogoAccent, string> = {
  none: "ring-border/60",
  google: "ring-[#4285F4]/35 shadow-[0_0_20px_-4px_rgba(66,133,244,0.35)]",
  meta: "ring-[#0866FF]/35 shadow-[0_0_20px_-4px_rgba(8,102,255,0.35)]",
  tiktok: "ring-black/20 shadow-[0_0_16px_-4px_rgba(0,0,0,0.2)]",
  whatsapp: "ring-[#25D366]/40 shadow-[0_0_18px_-4px_rgba(37,211,102,0.35)]",
  violet: "ring-violet-500/30 shadow-[0_0_16px_-4px_rgba(139,92,246,0.25)]",
  indigo: "ring-indigo-500/35 shadow-[0_0_16px_-4px_rgba(99,102,241,0.3)]",
  ativa: "ring-[hsl(252,56%,50%)]/40 shadow-[0_0_18px_-4px_hsla(252,56%,42%,0.35)]",
  slate: "ring-slate-400/35",
  hotmart: "ring-[#F04E23]/35 shadow-[0_0_16px_-4px_rgba(240,78,35,0.3)]",
  kiwify: "ring-[#16A34A]/40 shadow-[0_0_16px_-4px_rgba(22,163,74,0.35)]",
  eduzz: "ring-[#0f172a]/35 shadow-[0_0_14px_-3px_rgba(250,204,21,0.25)]",
  braip: "ring-[#00AEEF]/40 shadow-[0_0_16px_-4px_rgba(0,174,239,0.35)]",
  greenn: "ring-[#16A34A]/40 shadow-[0_0_16px_-4px_rgba(22,163,74,0.3)]",
};

export function IntegrationLogo({ src, alt, size = "md", className, accent = "none" }: Props) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-background to-muted/50 ring-1 ring-inset",
        accentRing[accent],
        sizes[size],
        className
      )}
    >
      <img src={src} alt={alt} className="object-contain" loading="lazy" decoding="async" />
    </div>
  );
}
