import { useEffect } from "react";

const BASE = "Ativa Dash";

/** Partes antes do sufixo fixo, ex.: `formatPageTitle(["Painel ADS", workspace])` */
export function formatPageTitle(parts: string[]) {
  const head = parts.map((p) => p.trim()).filter(Boolean);
  return head.length ? `${head.join(" · ")} · ${BASE}` : BASE;
}

/** Atualiza `document.title` ao montar e quando `title` muda. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title == null || title === "") return;
    document.title = title;
  }, [title]);
}
