import { Check, Link2Off } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IX } from "@/lib/integrationsCopy";

interface IntegrationCardProps {
  name: string;
  logoSrc?: string;
  connected: boolean;
  lastSync?: string;
  available?: boolean;
  connecting?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConfigure?: () => void;
}

export function IntegrationCard({
  name,
  logoSrc,
  connected,
  lastSync,
  available = true,
  connecting = false,
  onConnect,
  onDisconnect,
  onConfigure,
}: IntegrationCardProps) {
  return (
    <Card
      className={cn(
        "relative flex min-h-[140px] flex-col rounded-xl transition-shadow hover:shadow-md",
        connected && "ring-2 ring-[hsl(var(--success))]",
        !available && "opacity-70"
      )}
    >
      {connected && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--success))]">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          {logoSrc && (
            <img src={logoSrc} alt="" className="h-8 w-8 object-contain" />
          )}
          <span className="text-lg font-semibold text-foreground">{name}</span>
        </div>
        {connected && lastSync && (
          <p className="mb-2 text-center text-xs text-muted-foreground">
            {IX.ultimaSync}
            {lastSync}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {connected ? (
            <>
              {onConfigure && (
                <Button variant="outline" size="sm" className="rounded-lg" onClick={onConfigure}>
                  Configurar
                </Button>
              )}
              {onDisconnect && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onDisconnect}
                >
                  <Link2Off className="mr-1 h-3.5 w-3.5" />
                  Desvincular
                </Button>
              )}
            </>
          ) : available ? (
            onConnect ? (
              <Button size="sm" className="rounded-lg" onClick={onConnect} disabled={connecting}>
                {connecting ? "Redirecionando..." : "Conectar"}
              </Button>
            ) : null
          ) : (
            <span className="text-xs text-muted-foreground">Em breve</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
