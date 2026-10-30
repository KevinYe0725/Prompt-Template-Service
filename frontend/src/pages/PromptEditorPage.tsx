import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save, Sparkles } from "lucide-react";
import { promptApi } from "../api/promptApi";
import { useToast } from "../components/ToastProvider";
import { VariableChips } from "../components/VariableChips";
import { useI18n } from "../i18n";
import type { PromptCreateRequest, PromptTemplate } from "../types/prompt";
import { mergeEditableMessages } from "../utils/editableMessages";
import { parseVariablesFromMessages, parseVariablesFromText } from "../utils/variables";

type EditorState = {
  name: string;
  version: string;
  scenario: string;
  task_type: string;
  output_format: "text" | "json" | "markdown";
  description: string;
  content: string;
  systemPrompt: string;
  userPrompt: string;
  enabled: boolean;
};

const emptyState: EditorState = {
  name: "",
  version: "v1",
  scenario: "interview",
  task_type: "question_generation",
  output_format: "json",
  description: "",
  content: "",
  systemPrompt: "",
  userPrompt: "",
  enabled: false
};

function stateFromPrompt(prompt: PromptTemplate, duplicate: boolean): EditorState {
  const messages = prompt.messages ?? [];
  const systemPrompt = messages.find((message) => message.role === "system")?.content ?? "";
  const userPrompt = messages.find((message) => message.role === "user")?.content ?? "";

  return {
    name: prompt.name,
    version: duplicate ? "" : prompt.version,
    scenario: prompt.scenario,
    task_type: prompt.task_type,
    output_format: prompt.output_format,
    description: prompt.description ?? "",
    content: prompt.content ?? "",
    systemPrompt,
    userPrompt,
    enabled: false
  };
}

export function PromptEditorPage({
  id,
  duplicate,
  navigate
}: {
  id?: number;
  duplicate?: boolean;
  navigate: (path: string) => void;
}) {
  const { showToast } = useToast();
  const { t, language } = useI18n();
  const [form, setForm] = useState<EditorState>(emptyState);
  const [basePrompt, setBasePrompt] = useState<PromptTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isEditing = Boolean(id) && !duplicate;
  const isNewVersion = Boolean(id) && Boolean(duplicate);
  const isText = basePrompt?.template_type === "text";

  useEffect(() => {
    if (!id) {
      setForm(emptyState);
      return;
    }
    promptApi
      .getPrompt(id)
      .then((prompt) => {
        setBasePrompt(prompt);
        setForm(stateFromPrompt(prompt, Boolean(duplicate)));
        setDirty(false);
      })
      .catch((error) => showToast(error instanceof Error ? error.message : t("toast.loadPromptFailed"), "error"));
  }, [id, duplicate]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const messages = useMemo(() => {
    if (!isEditing || !basePrompt?.messages) {
      return [
        { role: "system", content: form.systemPrompt },
        { role: "user", content: form.userPrompt }
      ];
    }
    return mergeEditableMessages(basePrompt.messages, form.systemPrompt, form.userPrompt);
  }, [isEditing, basePrompt, form.systemPrompt, form.userPrompt]);
  const variables = useMemo(
    () => isText ? parseVariablesFromText(form.content) : parseVariablesFromMessages(messages),
    [isText, form.content, messages]
  );

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (isNewVersion && id) {
        const created = await promptApi.createPromptVersion(id, {
          version: form.version,
          ...(isText ? { content: form.content } : { messages }),
          description: form.description,
          enabled: form.enabled
        });
        showToast(t("toast.newVersionSaved"));
        setDirty(false);
        navigate(`/admin/prompts/${created.id}`);
      } else if (isEditing && id) {
        const updated = await promptApi.updatePrompt(id, {
          scenario: form.scenario,
          task_type: form.task_type,
          output_format: form.output_format,
          description: form.description,
          ...(isText ? { template_type: "text" as const, content: form.content } : { template_type: "chat" as const, messages })
        });
        showToast(t("toast.promptSaved"));
        setDirty(false);
        navigate(`/admin/prompts/${updated.id}`);
      } else {
        const payload: PromptCreateRequest = {
          name: form.name,
          version: form.version,
          scenario: form.scenario,
          task_type: form.task_type,
          template_type: "chat",
          messages,
          output_format: form.output_format,
          enabled: form.enabled,
          description: form.description
        };
        const created = await promptApi.createPrompt(payload);
        showToast(t("toast.promptCreated"));
        setDirty(false);
        navigate(`/admin/prompts/${created.id}`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("toast.savePromptFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function generateDraft() {
    if ((form.systemPrompt.trim() || form.userPrompt.trim()) && !window.confirm(t("editor.overwriteDraftConfirm"))) {
      return;
    }

    setGeneratingDraft(true);
    try {
      const draft = await promptApi.generatePromptDraft({
        name: form.name,
        scenario: form.scenario,
        task_type: form.task_type,
        output_format: form.output_format,
        description: form.description,
        existing_system_prompt: form.systemPrompt || null,
        existing_user_prompt: form.userPrompt || null,
        language,
        temperature: 0.4,
        max_tokens: 1800
      });
      setForm((current) => ({
        ...current,
        systemPrompt: draft.system_prompt,
        userPrompt: draft.user_prompt
      }));
      setDirty(true);
      showToast(`${t("toast.draftGenerated")} · ${draft.model} · ${draft.latency_ms} ms`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("toast.generateDraftFailed"), "error");
    } finally {
      setGeneratingDraft(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="detail-header">
        <button className="text-button" type="button" onClick={() => navigate(id ? `/admin/prompts/${id}` : "/admin/prompts")}>
          {t("common.back")}
        </button>
        <div className="detail-title-row">
          <div>
            <p className="eyebrow">{isNewVersion ? t("editor.newVersion") : isEditing ? t("editor.editPrompt") : t("editor.newPrompt")}</p>
            <h1>{isNewVersion ? basePrompt?.name || t("editor.duplicateTitle") : isEditing ? form.name : t("editor.createTitle")}</h1>
            {isEditing && <p className="hero-copy">{t("editor.editWarning")}</p>}
          </div>
        </div>
      </section>

      <form className="editor-layout" onSubmit={save}>
        <section className="glass-panel editor-form">
          <div className="form-grid">
            <label>
              <span>{t("editor.name")}</span>
              <input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                disabled={isEditing || isNewVersion}
                required
              />
            </label>
            <label>
              <span>{t("editor.version")}</span>
              <input
                value={form.version}
                onChange={(event) => update("version", event.target.value)}
                disabled={isEditing}
                required
                placeholder={isNewVersion ? "v2" : "v1"}
              />
            </label>
            <label>
              <span>{t("editor.scenario")}</span>
              <input value={form.scenario} onChange={(event) => update("scenario", event.target.value)} required />
            </label>
            <label>
              <span>{t("editor.taskType")}</span>
              <input value={form.task_type} onChange={(event) => update("task_type", event.target.value)} required />
            </label>
            <label>
              <span>{t("editor.outputFormat")}</span>
              <select value={form.output_format} onChange={(event) => update("output_format", event.target.value as EditorState["output_format"])}>
                <option value="text">text</option>
                <option value="json">json</option>
                <option value="markdown">markdown</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => update("enabled", event.target.checked)}
                disabled={isEditing}
              />
              <span>{t("editor.enableAfterSave")}</span>
            </label>
          </div>

          <label>
            <span>{t("editor.description")}</span>
            <input value={form.description} onChange={(event) => update("description", event.target.value)} />
          </label>

          {!isText && <div className="ai-draft-panel">
            <div>
              <h2>{t("editor.aiDraftTitle")}</h2>
              <p>{t("editor.aiDraftCopy")}</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={generateDraft}
              disabled={generatingDraft || !form.name || !form.scenario || !form.task_type}
            >
              <Sparkles size={17} />
              {generatingDraft ? t("editor.generatingDraft") : t("editor.generateDraft")}
            </button>
          </div>}

          {isText ? <label>
            <span>{t("editor.textContent")}</span>
            <textarea
              className="prompt-textarea"
              value={form.content}
              onChange={(event) => update("content", event.target.value)}
              required
            />
          </label> : <>
          <label>
            <span>{t("editor.systemPrompt")}</span>
            <textarea
              className="prompt-textarea"
              value={form.systemPrompt}
              onChange={(event) => update("systemPrompt", event.target.value)}
              required
            />
          </label>

          <label>
            <span>{t("editor.userPrompt")}</span>
            <textarea
              className="prompt-textarea"
              value={form.userPrompt}
              onChange={(event) => update("userPrompt", event.target.value)}
              required
            />
          </label>
          </>}

          <div className="toolbar sticky-actions">
            {isEditing && (
              <button className="secondary-button" type="button" onClick={() => navigate(`/admin/prompts/${id}/edit?newVersion=1`)}>
                {t("editor.saveAsNewVersion")}
              </button>
            )}
            <button className="primary-button" type="submit" disabled={saving}>
              <Save size={17} />
              {saving ? t("editor.saving") : t("editor.save")}
            </button>
          </div>
        </section>

        <aside className="glass-panel editor-side">
          <h2>{t("editor.detectedVariables")}</h2>
          <VariableChips variables={variables} />
          <div className="side-note">
            {t("editor.variableHelp", { placeholder: "{{variable_name}}" })}
          </div>
          <h2>{isText ? t("editor.textContent") : t("editor.messages")}</h2>
          <pre className="code-block">{isText ? form.content : JSON.stringify(messages, null, 2)}</pre>
        </aside>
      </form>
    </main>
  );
}
