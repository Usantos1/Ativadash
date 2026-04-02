import { useRef } from "react";
import { Bell, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { MemberRow } from "@/lib/workspace-api";
import { TEAM_JOB_TITLE_OPTIONS, jobTitleLabelPt } from "@/lib/team-access-ui";
import type { AlertRuleActionType, AlertRuleEvaluationLevel, AlertRuleMetric, AlertRuleOperator, AlertRuleThresholdRef } from "@/lib/alert-rules-api";
import {
  ACTION_OPTIONS,
  FREQUENCY_OPTIONS,
  LEVEL_OPTIONS,
  MESSAGE_CHIPS,
  METRIC_OPTIONS,
  OPERATOR_OPTIONS,
  type RuleDraft,
  insertIntoTextarea,
} from "./rule-draft";

export type RuleBuilderSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: RuleDraft | null;
  onChange: (patch: Partial<RuleDraft>) => void;
  canEdit: boolean;
  tz: string;
  members: MemberRow[];
  automationChannel: "meta" | "google";
  thresholdRefOptions: (r: RuleDraft) => { value: AlertRuleThresholdRef | "fixed"; label: string }[];
};

export function RuleBuilderSheet({
  open,
  onOpenChange,
  draft,
  onChange,
  canEdit,
  tz,
  members,
  automationChannel,
  thresholdRefOptions,
}: RuleBuilderSheetProps) {
  const tplRef = useRef<HTMLTextAreaElement | null>(null);

  if (!draft) return null;

  const r = draft;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={r.name.trim() || "Nova regra"}
        description="Configure gatilho, ação, WhatsApp e cadência do motor."
        className="max-w-[min(100vw,36rem)] sm:max-w-xl lg:max-w-2xl"
      >
        <div className="space-y-6 pb-8">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Nome da regra</Label>
            <Input
              value={r.name}
              disabled={!canEdit}
              onChange={(e) => onChange({ name: e.target.value })}
              className="rounded-xl"
            />
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Quando (cadência)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Frequência legada (janela local)</Label>
                <Select
                  value={r.checkFrequency}
                  disabled={!canEdit}
                  onValueChange={(v) => onChange({ checkFrequency: v as RuleDraft["checkFrequency"] })}
                >
                  <SelectTrigger className="h-9 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Intervalo mínimo do worker (min)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="ex.: 30 (vazio = só legado)"
                  disabled={!canEdit}
                  value={r.checkFrequencyMinutesStr}
                  onChange={(e) => onChange({ checkFrequencyMinutesStr: e.target.value })}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Janela de expediente (local)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Das</span>
                <Input
                  type="time"
                  disabled={!canEdit}
                  value={r.actionWindowStartLocal || ""}
                  onChange={(e) => onChange({ actionWindowStartLocal: e.target.value })}
                  className="h-9 w-[7rem] rounded-lg"
                />
                <span className="text-xs text-muted-foreground">às</span>
                <Input
                  type="time"
                  disabled={!canEdit}
                  value={r.actionWindowEndLocal || ""}
                  onChange={(e) => onChange({ actionWindowEndLocal: e.target.value })}
                  className="h-9 w-[7rem] rounded-lg"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Fuso: {tz}.</p>
              <p className="text-[10px] text-amber-800 dark:text-amber-200/90">
                Com <strong>das / às</strong> preenchidos, o motor <strong>só corre esta regra dentro desta janela</strong> (horário
                local). Fora disso não há avaliação nem WhatsApp. Para <strong>24 horas</strong>, limpe os dois campos de hora e clique
                em Salvar automações.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Silêncio UTC (início 0–23)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="vazio = off"
                  disabled={!canEdit}
                  value={r.muteStartHourStr}
                  onChange={(e) => onChange({ muteStartHourStr: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Silêncio UTC (fim 0–23)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="vazio = off"
                  disabled={!canEdit}
                  value={r.muteEndHourStr}
                  onChange={(e) => onChange({ muteEndHourStr: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Se (condição)</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Nível</span>
              <Select
                value={r.evaluationLevel}
                disabled={!canEdit}
                onValueChange={(v) => onChange({ evaluationLevel: v as AlertRuleEvaluationLevel })}
              >
                <SelectTrigger className="h-9 w-[10rem] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs">com métrica</span>
              <Select
                value={r.metric}
                disabled={!canEdit}
                onValueChange={(v) => onChange({ metric: v as AlertRuleMetric })}
              >
                <SelectTrigger className="h-9 w-[12rem] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {automationChannel === "google" && r.evaluationLevel === "ad" ? (
              <p className="text-[10px] text-muted-foreground">
                Google no nível anúncio: ±% orçamento aplica-se à campanha associada.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={r.operator}
                disabled={!canEdit}
                onValueChange={(v) => {
                  const op = v as AlertRuleOperator;
                  if (op === "cpa_band") {
                    onChange({ operator: op, metric: "cpa", thresholdRef: null, thresholdStr: "" });
                  } else {
                    onChange({ operator: op });
                  }
                }}
              >
                <SelectTrigger className="h-9 w-[11rem] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex flex-col text-left">
                        <span>{o.label}</span>
                        {o.hint ? <span className="text-[10px] text-muted-foreground">{o.hint}</span> : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {r.operator !== "outside_target" && r.operator !== "cpa_band" ? (
                <>
                  <Select
                    value={r.thresholdRef ?? "fixed"}
                    disabled={!canEdit}
                    onValueChange={(v) =>
                      onChange({
                        thresholdRef: v === "fixed" ? null : (v as AlertRuleThresholdRef),
                        thresholdStr: v === "fixed" ? (r.thresholdStr || "50") : "0",
                      })
                    }
                  >
                    <SelectTrigger className="h-9 min-w-[10rem] max-w-[20rem] rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {thresholdRefOptions(r).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!r.thresholdRef ? (
                    <Input
                      inputMode="decimal"
                      className="h-9 w-[6.5rem] rounded-lg"
                      disabled={!canEdit}
                      value={r.thresholdStr}
                      onChange={(e) => onChange({ thresholdStr: e.target.value })}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">(variável das metas)</span>
                  )}
                </>
              ) : r.operator === "outside_target" ? (
                <span className="text-xs">(fora da meta global)</span>
              ) : (
                <span className="text-xs">(CPL entre alvo e teto)</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Então (ação)</p>
            <Select
              value={r.actionType}
              disabled={!canEdit}
              onValueChange={(v) => onChange({ actionType: v as AlertRuleActionType })}
            >
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex flex-col text-left">
                      <span>{o.label}</span>
                      {o.hint ? <span className="text-[10px] text-muted-foreground">{o.hint}</span> : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">% escala (aumentar/reduzir)</Label>
                <Input
                  inputMode="numeric"
                  disabled={!canEdit}
                  value={r.actionValueStr}
                  onChange={(e) => onChange({ actionValueStr: e.target.value })}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Cooldown por ativo (minutos)</Label>
                <Input
                  inputMode="numeric"
                  disabled={!canEdit}
                  value={r.cooldownMinutesStr}
                  onChange={(e) => onChange({ cooldownMinutesStr: e.target.value })}
                  className="h-9 rounded-lg font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/15 p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Onde (WhatsApp)</p>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
              <span className="text-sm">Notificar no WhatsApp</span>
              <Switch
                checked={r.notifyWhatsapp}
                disabled={!canEdit}
                onCheckedChange={(v) => onChange({ notifyWhatsapp: v })}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Destinatários</Label>
                </div>
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-background/80 p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Cargos</p>
                  {TEAM_JOB_TITLE_OPTIONS.map((jt) => (
                    <label key={jt.value} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        disabled={!canEdit}
                        checked={r.routingJobSlugs.includes(jt.value)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          onChange({
                            routingJobSlugs: on
                              ? [...r.routingJobSlugs, jt.value]
                              : r.routingJobSlugs.filter((x) => x !== jt.value),
                          });
                        }}
                      />
                      <span>Todos: {jt.label}</span>
                    </label>
                  ))}
                </div>
                <div className="max-h-32 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-background/80 p-3">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Pessoas</p>
                  {members.map((m) => (
                    <label key={m.userId} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        disabled={!canEdit}
                        checked={r.routingUserIds.includes(m.userId)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          onChange({
                            routingUserIds: on
                              ? [...r.routingUserIds, m.userId]
                              : r.routingUserIds.filter((x) => x !== m.userId),
                          });
                        }}
                      />
                      <span className="min-w-0 truncate">
                        {m.name}{" "}
                        <span className="text-muted-foreground">({jobTitleLabelPt(m.jobTitle ?? null)})</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Números customizados</Label>
                  <Input
                    placeholder="5511999999999"
                    disabled={!canEdit}
                    value={r.routingCustomPhonesStr}
                    onChange={(e) => onChange({ routingCustomPhonesStr: e.target.value })}
                    className="h-9 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Modelo de mensagem</Label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MESSAGE_CHIPS.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        insertIntoTextarea(tplRef.current, r.messageTemplate, c.insert, (v) =>
                          onChange({ messageTemplate: v })
                        )
                      }
                      className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={tplRef}
                  disabled={!canEdit}
                  value={r.messageTemplate}
                  onChange={(e) => onChange({ messageTemplate: e.target.value })}
                  className="min-h-[140px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span className="rounded-md border border-border/50 px-2 py-1">
              Escopo:{" "}
              {r.appliesToChannel === "all"
                ? "Todos os canais"
                : r.appliesToChannel === "meta"
                  ? "Meta Ads"
                  : "Google Ads"}
            </span>
            <span className="rounded-md border border-border/50 px-2 py-1">
              Canal da aba: {automationChannel === "meta" ? "Meta" : "Google"}
            </span>
          </div>

          <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>
            Fechar editor
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
