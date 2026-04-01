import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable;
}

/**
 * Atalhos: G+D dashboard, G+P marketing, G+C clientes, ? ajuda, / foco busca (dispatch evento).
 * Escape em modais é tratado pelo Radix.
 */
export function useGlobalHotkeys() {
  const navigate = useNavigate();
  const gAt = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.key === "s" || e.key === "S") && !isTypingTarget(e.target)) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("ativadash:save-active-form"));
        }
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (document.querySelector("[data-radix-dialog-content]") || document.querySelector("[data-state=open][role=dialog]")) {
        if (e.key === "?" || e.key === "/") return;
      }

      const k = e.key.toLowerCase();
      if (k === "g") {
        gAt.current = Date.now();
        return;
      }
      if (Date.now() - gAt.current > 900) return;

      if (k === "d") {
        e.preventDefault();
        navigate("/dashboard");
        return;
      }
      if (k === "p") {
        e.preventDefault();
        navigate("/marketing");
        return;
      }
      if (k === "c") {
        e.preventDefault();
        navigate("/clientes");
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("ativadash:open-shortcuts-modal"));
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("ativadash:focus-page-search"));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
