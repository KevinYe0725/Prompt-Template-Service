import { useEffect, useState } from "react";
import { CopyPlus, Edit3, Play, Power } from "lucide-react";
import { promptApi } from "../api/promptApi";
import { MessagePreview } from "../components/MessagePreview";
import { useToast } from "../components/ToastProvider";
import { VariableChips } from "../components/VariableChips";
import { VersionList } from "../components/VersionList";
import { useI18n } from "../i18n";
import type { PromptTemplate, PromptTemplateListItem } from "../types/prompt";

export function PromptDetailPage({
  id,
  navigate
}: {
  id: number;
  navigate: (path: string) => void;
}) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [prompt, setPrompt] = useState<PromptTemplate | null>(null);
  const [versions, setVersions] = useState<PromptTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [detail, versionRows] = await Promise.all([
        promptApi.getPrompt(id),
        promptApi.listPromptVersions(id)
      ]);
      setPrompt(detail);
      setVersions(versionRows);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("toast.loadPromptFailed"), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function activate(versionId = id) {
    if (!window.confirm(t("confirm.activate"))) {
      return;
    }
    try {
      await promptApi.activatePrompt(versionId);
      showToast(t("toast.versionActivated"));
      navigate(`/admin/prompts/${versionId}`);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("toast.activateFailed"), "error");
    }
  }

  if (loading) {
    return <main className="page-shell"><div className="empty-panel">{t("detail.loading")}</div></main>;
  }

  if (!prompt) {
    return <main className="page-shell"><div className="empty-panel">{t("detail.notFound")}</div></main>;
  }

  return (
    <main className="page-shell">
      <section className="detail-header">
        <button className="text-button" type="button" onClick={() => navigate("/admin/prompts")}>
          {t("common.backToLibrary")}
        </button>
        <div className="detail-title-row">
          <div>
            <p className="eyebrow">{prompt.scenario} · {prompt.task_type}</p>
            <h1>{prompt.name}</h1>
            <p className="hero-copy">{prompt.description || t("common.noDescription")}</p>
          </div>
          <span className={`status-badge ${prompt.enabled ? "status-active" : "status-muted"}`}>
            {prompt.enabled ? t("common.active") : t("common.inactive")}
          </span>
        </div>
        <div className="toolbar">
          <button className="secondary-button" type="button" onClick={() => navigate(`/admin/prompts/${id}/edit`)}>
            <Edit3 size={17} />
            {t("detail.edit")}
          </button>
          <button className="secondary-button" type="button" onClick={() => navigate(`/admin/prompts/${id}/edit?newVersion=1`)}>
            <CopyPlus size={17} />
            {t("detail.duplicate")}
          </button>
          <button className="primary-button" type="button" onClick={() => navigate(`/admin/prompts/${id}/playground`)}>
            <Play size={17} />
            {t("detail.playground")}
          </button>
          {!prompt.enabled && (
            <button className="secondary-button" type="button" onClick={() => activate(id)}>
              <Power size={17} />
              {t("detail.activateVersion")}
            </button>
          )}
        </div>
      </section>

      <section className="detail-grid">
        <div className="glass-panel">
          <h2>{t("detail.template")}</h2>
          <div className="info-grid">
            <div><span>{t("detail.version")}</span><strong>{prompt.version}</strong></div>
            <div><span>{t("detail.type")}</span><strong>{prompt.template_type}</strong></div>
            <div><span>{t("detail.output")}</span><strong>{prompt.output_format}</strong></div>
            <div><span>{t("detail.updated")}</span><strong>{new Date(prompt.updated_at).toLocaleString()}</strong></div>
          </div>
          <h3>{t("detail.variables")}</h3>
          <VariableChips variables={prompt.variables} />
          <h3>{t("detail.messages")}</h3>
          <MessagePreview messages={prompt.messages ?? undefined} content={prompt.content} />
        </div>

        <aside className="glass-panel">
          <h2>{t("detail.versions")}</h2>
          <VersionList
            versions={versions}
            onOpen={(versionId) => navigate(`/admin/prompts/${versionId}`)}
            onPlayground={(versionId) => navigate(`/admin/prompts/${versionId}/playground`)}
            onActivate={activate}
          />
        </aside>
      </section>
    </main>
  );
}
