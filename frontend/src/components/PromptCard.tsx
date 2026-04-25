import { ArrowRight, CircleCheck, CircleDashed } from "lucide-react";
import { useI18n } from "../i18n";
import type { PromptTemplateListItem } from "../types/prompt";

export function PromptCard({
  prompt,
  onOpen
}: {
  prompt: PromptTemplateListItem;
  onOpen: (id: number) => void;
}) {
  const { t } = useI18n();

  return (
    <button className="prompt-card" type="button" onClick={() => onOpen(prompt.id)}>
      <div className="prompt-card-main">
        <div>
          <div className="prompt-name">{prompt.name}</div>
          <div className="prompt-description">{prompt.description || t("common.noDescription")}</div>
        </div>
        <span className={`status-badge ${prompt.enabled ? "status-active" : "status-muted"}`}>
          {prompt.enabled ? <CircleCheck size={14} /> : <CircleDashed size={14} />}
          {prompt.enabled ? t("common.active") : t("common.inactive")}
        </span>
      </div>
      <div className="prompt-meta-grid">
        <span>{prompt.scenario}</span>
        <span>{prompt.task_type}</span>
        <span>{t("list.representativeVersion", { version: prompt.version })}</span>
        <span>{t("list.versionsCount", { count: prompt.versions_count })}</span>
        <span>{prompt.output_format}</span>
        <span>{t("list.variablesCount", { count: prompt.variables.length })}</span>
        <span>{new Date(prompt.updated_at).toLocaleString()}</span>
      </div>
      <ArrowRight className="prompt-arrow" size={18} />
    </button>
  );
}
