import { useEffect, useState } from "react";
import { Copy, Play, Sparkles, WandSparkles } from "lucide-react";
import { PromptApiError, promptApi } from "../api/promptApi";
import { JsonEditor } from "../components/JsonEditor";
import { MarkdownViewer } from "../components/MarkdownViewer";
import { MessagePreview } from "../components/MessagePreview";
import { useToast } from "../components/ToastProvider";
import { VariableChips } from "../components/VariableChips";
import { useI18n } from "../i18n";
import type { PromptRenderResponse, PromptTemplate, PromptTestResponse } from "../types/prompt";
import { buildVariablesJson, safeJsonParse } from "../utils/variables";

const MODEL_OPTIONS = ["deepseek-chat", "deepseek-reasoner", "qwen-plus", "kimi", "custom"];
const MODEL_MAX_OUTPUT_TOKENS: Record<string, number> = {
  "deepseek-chat": 384000,
  "deepseek-reasoner": 384000,
  "deepseek-v4-flash": 384000,
  "deepseek-v4-pro": 384000
};

function getModelMaxTokens(model: string) {
  return MODEL_MAX_OUTPUT_TOKENS[model];
}

export function PromptPlaygroundPage({
  id,
  navigate
}: {
  id: number;
  navigate: (path: string) => void;
}) {
  const { showToast } = useToast();
  const { t, language } = useI18n();
  const [prompt, setPrompt] = useState<PromptTemplate | null>(null);
  const [variablesJson, setVariablesJson] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [missingVariables, setMissingVariables] = useState<string[]>([]);
  const [preview, setPreview] = useState<PromptRenderResponse | null>(null);
  const [testResult, setTestResult] = useState<PromptTestResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [generatingVariables, setGeneratingVariables] = useState(false);
  const [modelChoice, setModelChoice] = useState("deepseek-chat");
  const [customModel, setCustomModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1200);

  useEffect(() => {
    promptApi
      .getPrompt(id)
      .then((detail) => {
        setPrompt(detail);
        setVariablesJson(buildVariablesJson(detail.variables));
      })
      .catch((error) => showToast(error instanceof Error ? error.message : t("toast.loadPromptFailed"), "error"));
  }, [id]);

  function parseVariables() {
    const parsed = safeJsonParse(variablesJson);
    setJsonError(
      parsed.error === "object"
        ? t("json.objectError")
        : parsed.error === "syntax"
          ? t("json.syntaxError")
          : null
    );
    if (parsed.error || !parsed.value) {
      return null;
    }
    return parsed.value;
  }

  async function previewRender() {
    const variables = parseVariables();
    if (!variables) return;
    setMissingVariables([]);
    setPreviewLoading(true);
    try {
      const result = await promptApi.previewPrompt(id, variables);
      setPreview(result);
      showToast(t("toast.previewReady"));
    } catch (error) {
      if (error instanceof PromptApiError && error.missingVariables.length) {
        setMissingVariables(error.missingVariables);
      }
      showToast(error instanceof Error ? error.message : t("toast.previewFailed"), "error");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function generateTestVariables() {
    if (!prompt) return;
    const model = modelChoice === "custom" ? customModel : modelChoice;
    setGeneratingVariables(true);
    setJsonError(null);
    setMissingVariables([]);
    try {
      const result = await promptApi.generateTestVariables(id, {
        language,
        model: model || null,
        temperature: 0.5,
        max_tokens: 1800
      });
      setVariablesJson(JSON.stringify(result.variables, null, 2));
      setPreview(null);
      setTestResult(null);
      showToast(`${t("toast.testVariablesGenerated")} · ${result.model} · ${result.latency_ms} ms`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("toast.generateTestVariablesFailed"), "error");
    } finally {
      setGeneratingVariables(false);
    }
  }

  async function testModel() {
    const variables = parseVariables();
    if (!variables) return;
    const model = modelChoice === "custom" ? customModel : modelChoice;
    const modelMaxTokens = getModelMaxTokens(model);
    if (modelMaxTokens && maxTokens > modelMaxTokens) {
      showToast(t("toast.maxTokensExceeded", { limit: modelMaxTokens }), "error");
      return;
    }
    setMissingVariables([]);
    setTestLoading(true);
    try {
      const result = await promptApi.testPrompt(id, {
        variables,
        model,
        temperature,
        max_tokens: maxTokens
      });
      setTestResult(result);
      setPreview({
        template_id: result.template_id,
        name: result.name,
        version: result.version,
        template_type: "chat",
        messages: result.rendered_messages,
        variables
      });
      showToast(t("toast.modelComplete"));
    } catch (error) {
      if (error instanceof PromptApiError && error.missingVariables.length) {
        setMissingVariables(error.missingVariables);
      }
      showToast(error instanceof Error ? error.message : t("toast.modelFailed"), "error");
    } finally {
      setTestLoading(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    showToast(t("common.copied"));
  }

  return (
    <main className="page-shell">
      <section className="detail-header">
        <button className="text-button" type="button" onClick={() => navigate(`/admin/prompts/${id}`)}>
          {t("common.backToPrompt")}
        </button>
        <div className="detail-title-row">
          <div>
            <p className="eyebrow">{t("playground.eyebrow")}</p>
            <h1>{prompt?.name ?? t("playground.promptFallback")}</h1>
            <p className="hero-copy">
              {t("playground.copy")}
            </p>
          </div>
          {prompt && <span className={`status-badge ${prompt.enabled ? "status-active" : "status-muted"}`}>{prompt.version}</span>}
        </div>
      </section>

      <section className="playground-grid">
        <div className="glass-panel">
          <div className="section-title-row">
            <div>
              <h2>{t("playground.variables")}</h2>
              <p>{t("playground.generateVariablesHint")}</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={generateTestVariables}
              disabled={generatingVariables || !prompt || !prompt.variables.length}
            >
              <Sparkles size={17} />
              {generatingVariables ? t("playground.generatingVariables") : t("playground.generateVariables")}
            </button>
          </div>
          <VariableChips variables={prompt?.variables ?? []} />
          <JsonEditor
            value={variablesJson}
            onChange={setVariablesJson}
            error={jsonError}
            missingVariables={missingVariables}
          />

          <div className="model-panel">
            <h2>{t("playground.modelTest")}</h2>
            <div className="form-grid compact">
              <label>
                <span>{t("playground.model")}</span>
                <select value={modelChoice} onChange={(event) => setModelChoice(event.target.value)}>
                  {MODEL_OPTIONS.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
              {modelChoice === "custom" && (
                <label>
                  <span>{t("playground.customModel")}</span>
                  <input value={customModel} onChange={(event) => setCustomModel(event.target.value)} placeholder={t("playground.customModelPlaceholder")} />
                </label>
              )}
              <label>
                <span>{t("playground.temperature")}</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                />
              </label>
              <label>
                <span>{t("playground.maxTokens")}</span>
                <input
                  type="number"
                  min="1"
                  max={getModelMaxTokens(modelChoice === "custom" ? customModel : modelChoice)}
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(Number(event.target.value))}
                />
                {getModelMaxTokens(modelChoice === "custom" ? customModel : modelChoice) && (
                  <span className="field-hint">
                    {t("playground.maxTokensHint", {
                      limit: getModelMaxTokens(modelChoice === "custom" ? customModel : modelChoice)
                    })}
                  </span>
                )}
                <span className="field-hint">{t("playground.maxTokensWarning")}</span>
              </label>
            </div>
          </div>

          <div className="toolbar">
            <button className="secondary-button" type="button" onClick={previewRender} disabled={previewLoading}>
              <WandSparkles size={17} />
              {previewLoading ? t("playground.rendering") : t("playground.previewRender")}
            </button>
            <button className="primary-button" type="button" onClick={testModel} disabled={testLoading}>
              <Play size={17} />
              {testLoading ? t("playground.testing") : t("playground.testWithModel")}
            </button>
          </div>
        </div>

        <div className="glass-panel">
          <h2>{t("playground.renderedMessages")}</h2>
          <MessagePreview
            messages={preview?.messages}
            content={preview?.content}
            onCopy={(value) => void copy(value)}
          />
        </div>
      </section>

      <section className="glass-panel">
        <div className="preview-toolbar">
          <h2>{t("playground.aiOutput")}</h2>
          {testResult?.ai_response && (
            <button className="icon-button" type="button" onClick={() => void copy(testResult.ai_response)} title={t("common.copy")}>
              <Copy size={16} />
            </button>
          )}
        </div>
        {testLoading ? (
          <div className="empty-panel">{t("playground.waiting")}</div>
        ) : testResult ? (
          <div>
            <div className="muted small">{testResult.model} · {testResult.latency_ms} ms</div>
            <MarkdownViewer content={testResult.ai_response} />
          </div>
        ) : (
          <div className="empty-panel">{t("playground.emptyOutput")}</div>
        )}
      </section>
    </main>
  );
}
