import { FormEvent, useEffect, useRef, useState } from "react";
import { CopyPlus, Edit3, Play, Power } from "lucide-react";
import { PromptApiError, promptApi } from "../api/promptApi";
import { MessagePreview } from "../components/MessagePreview";
import { useToast } from "../components/ToastProvider";
import { VariableChips } from "../components/VariableChips";
import { VersionList } from "../components/VersionList";
import { useI18n } from "../i18n";
import type { PromptTemplate, PromptTemplateListItem } from "../types/prompt";

// Match Python str.strip(), including whitespace not covered by JavaScript trim().
function normalizeName(name: string) {
  return name.replace(/^[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g, "");
}

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
  const [reloadKey, setReloadKey] = useState(0);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateError, setDuplicateError] = useState("");
  const [duplicatePending, setDuplicatePending] = useState(false);
  const duplicatePendingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const currentIdRef = useRef(id);
  const loadGenerationRef = useRef(0);
  currentIdRef.current = id;

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    const isCurrent = () => loadGenerationRef.current === generation && currentIdRef.current === id;
    setLoading(true);
    setPrompt(null);
    setVersions([]);
    setDuplicateOpen(false);
    setDuplicateError("");
    setDuplicatePending(false);
    duplicatePendingRef.current = false;
    void (async () => {
      try {
        const [detail, versionRows] = await Promise.all([
          promptApi.getPrompt(id),
          promptApi.listPromptVersions(id)
        ]);
        if (!isCurrent()) return;
        if (detail.id !== id) throw new Error(t("toast.loadPromptFailed"));
        setPrompt(detail);
        setVersions(versionRows);
      } catch (error) {
        if (isCurrent()) showToast(error instanceof Error ? error.message : t("toast.loadPromptFailed"), "error");
      } finally {
        if (isCurrent()) setLoading(false);
      }
    })();
    return () => {
      if (loadGenerationRef.current === generation) loadGenerationRef.current += 1;
    };
  }, [id, reloadKey]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (duplicateOpen && dialog && !dialog.open) {
      dialog.showModal();
      nameRef.current?.focus();
    } else if (!duplicateOpen && dialog?.open) {
      dialog.close();
    }
  }, [duplicateOpen]);

  async function duplicate(event: FormEvent) {
    event.preventDefault();
    if (duplicatePendingRef.current || loading || !prompt || prompt.id !== id) return;
    const sourceId = prompt.id;
    const generation = loadGenerationRef.current;
    const isCurrent = () => currentIdRef.current === sourceId && loadGenerationRef.current === generation;
    const name = normalizeName(duplicateName);
    if (!name || Array.from(name).length > 100) {
      setDuplicateError(t("duplicate.invalidName"));
      return;
    }
    duplicatePendingRef.current = true;
    setDuplicatePending(true);
    setDuplicateError("");
    try {
      const created = await promptApi.duplicatePrompt(sourceId, name);
      if (!isCurrent()) return;
      setDuplicateOpen(false);
      showToast(t("duplicate.created"));
      navigate(`/admin/prompts/${created.id}`);
    } catch (error) {
      if (!isCurrent()) return;
      setDuplicateError(
        error instanceof PromptApiError && error.status === 409
          ? t("duplicate.nameTaken")
          : error instanceof PromptApiError && error.status === 422
            ? t("duplicate.invalidName")
            : error instanceof Error ? error.message : t("duplicate.failed")
      );
    } finally {
      if (isCurrent()) {
        duplicatePendingRef.current = false;
        setDuplicatePending(false);
      }
    }
  }

  async function activate(versionId = id) {
    if (!window.confirm(t("confirm.activate"))) {
      return;
    }
    const generation = loadGenerationRef.current;
    const isCurrent = () => currentIdRef.current === id && loadGenerationRef.current === generation;
    try {
      await promptApi.activatePrompt(versionId);
      if (!isCurrent()) return;
      showToast(t("toast.versionActivated"));
      if (versionId === id) setReloadKey((value) => value + 1);
      else navigate(`/admin/prompts/${versionId}`);
    } catch (error) {
      if (isCurrent()) showToast(error instanceof Error ? error.message : t("toast.activateFailed"), "error");
    }
  }

  if (loading || (prompt && prompt.id !== id)) {
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
          <button className="secondary-button" type="button" onClick={() => {
            setDuplicateName(`${prompt.name}-copy`);
            setDuplicateError("");
            setDuplicateOpen(true);
          }}>
            <CopyPlus size={17} />
            {t("duplicate.action")}
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

      <dialog
        className="duplicate-dialog"
        ref={dialogRef}
        aria-labelledby="duplicate-title"
        aria-describedby="duplicate-hint"
        onCancel={(event) => {
          event.preventDefault();
          if (!duplicatePending) setDuplicateOpen(false);
        }}
      >
        <form onSubmit={duplicate} noValidate>
          <h2 id="duplicate-title">{t("duplicate.title")}</h2>
          <p id="duplicate-hint">{t("duplicate.hint", { version: prompt.version })}</p>
          <label>
            <span>{t("editor.name")}</span>
            <input
              ref={nameRef}
              value={duplicateName}
              onChange={(event) => { setDuplicateName(event.target.value); setDuplicateError(""); }}
              disabled={duplicatePending}
              aria-invalid={Boolean(duplicateError)}
              aria-describedby={duplicateError ? "duplicate-error" : undefined}
            />
          </label>
          {duplicateError && <p id="duplicate-error" className="inline-error" role="alert">{duplicateError}</p>}
          <div className="toolbar duplicate-actions">
            <button className="secondary-button" type="button" disabled={duplicatePending} onClick={() => setDuplicateOpen(false)}>
              {t("duplicate.cancel")}
            </button>
            <button className="primary-button" type="submit" disabled={duplicatePending}>
              {duplicatePending ? t("duplicate.pending") : t("duplicate.submit")}
            </button>
          </div>
        </form>
      </dialog>

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
