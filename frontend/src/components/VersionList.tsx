import { ExternalLink, Play, Power } from "lucide-react";
import { useI18n } from "../i18n";
import type { PromptTemplateListItem } from "../types/prompt";

export function VersionList({
  versions,
  onOpen,
  onPlayground,
  onActivate
}: {
  versions: PromptTemplateListItem[];
  onOpen: (id: number) => void;
  onPlayground: (id: number) => void;
  onActivate: (id: number) => void;
}) {
  const { t } = useI18n();

  if (!versions.length) {
    return <div className="empty-panel">{t("versions.empty")}</div>;
  }

  return (
    <div className="version-list">
      {versions.map((version) => (
        <div className="version-row" key={version.id}>
          <div>
            <div className="version-title">
              {version.version}
              <span className={`status-badge ${version.enabled ? "status-active" : "status-muted"}`}>
                {version.enabled ? t("common.active") : t("common.inactive")}
              </span>
            </div>
            <div className="muted small">
              {version.output_format} · {t("list.variablesCount", { count: version.variables.length })} ·{" "}
              {new Date(version.updated_at).toLocaleString()}
            </div>
          </div>
          <div className="row-actions">
            <button className="icon-button" type="button" onClick={() => onOpen(version.id)} title={t("common.open")}>
              <ExternalLink size={16} />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => onPlayground(version.id)}
              title={t("detail.playground")}
            >
              <Play size={16} />
            </button>
            {!version.enabled && (
              <button
                className="icon-button"
                type="button"
                onClick={() => onActivate(version.id)}
                title={t("common.activate")}
              >
                <Power size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
