import { Link } from "react-router-dom";
import { MARKETING_SITE_ORIGIN } from "@/lib/marketing-site";

/** Página de referência para o campo "User Data Deletion" em apps Meta / políticas de privacidade. */
export function DataDeletionPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Privacidade</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Exclusão de dados</h1>
      <p className="mt-4 text-muted-foreground">
        Para solicitar a exclusão ou o encerramento do tratamento dos seus dados pessoais associados à conta no{" "}
        <strong className="text-foreground">Ativa Dash</strong>, envie um pedido pelo e-mail abaixo, identificando a
        organização (empresa) e o e-mail da conta utilizada no sistema.
      </p>
      <p className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
        <strong className="text-foreground">E-mail:</strong>{" "}
        <a href="mailto:contato@ativadash.com?subject=Pedido%20de%20exclus%C3%A3o%20de%20dados" className="text-primary underline-offset-2 hover:underline">
          contato@ativadash.com
        </a>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Responderemos no prazo previsto na legislação aplicável. Podemos solicitar informações adicionais para confirmar
        sua identidade antes de processar o pedido. Dados que devam ser retidos por obrigação legal ou legítimo
        interesse poderão ser mantidos na medida permitida por lei.
      </p>
      <p className="mt-8 text-sm">
        <Link to="/politica-privacidade" className="font-semibold text-primary underline-offset-4 hover:underline">
          Política de Privacidade
        </Link>
        {" · "}
        <a href={MARKETING_SITE_ORIGIN} className="font-semibold text-primary underline-offset-4 hover:underline">
          Início
        </a>
      </p>
    </article>
  );
}
