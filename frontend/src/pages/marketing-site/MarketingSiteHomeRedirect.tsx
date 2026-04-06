import { useEffect } from "react";
import { MARKETING_SITE_ORIGIN } from "@/lib/marketing-site";

/** Redireciona quem acede a /produto no app para a home da LP no domínio principal. */
export function MarketingSiteHomeRedirect() {
  useEffect(() => {
    window.location.replace(`${MARKETING_SITE_ORIGIN}/`);
  }, []);
  return (
    <p className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
      A redirecionar para o site…
    </p>
  );
}
