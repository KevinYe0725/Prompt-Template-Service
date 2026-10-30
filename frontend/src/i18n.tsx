import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type Language = "zh" | "en";

const STORAGE_KEY = "prompt-studio-language";

const translations = {
  zh: {
    "app.brand": "提示词工作台",
    "app.switchTo": "English",
    "app.languageLabel": "切换语言",

    "common.back": "返回",
    "common.backToLibrary": "返回模板库",
    "common.backToPrompt": "返回模板详情",
    "common.search": "搜索",
    "common.previous": "上一页",
    "common.next": "下一页",
    "common.active": "启用中",
    "common.inactive": "未启用",
    "common.copy": "复制",
    "common.open": "打开",
    "common.activate": "启用",
    "common.loading": "加载中...",
    "common.noDescription": "暂无描述",
    "common.copied": "已复制",

    "list.eyebrow": "Prompt Template Service",
    "list.title": "提示词模板库",
    "list.copy": "集中管理版本化 Prompt，预览渲染结果，并在同一页面中测试模型输出。",
    "list.newPrompt": "新建模板",
    "list.searchPlaceholder": "按名称或描述搜索",
    "list.scenarioPlaceholder": "业务场景",
    "list.allStatus": "全部状态",
    "list.loading": "正在加载模板...",
    "list.emptyTitle": "还没有 Prompt 模板",
    "list.emptyCopy": "创建第一个模板，把模型行为从业务代码中抽离出来。",
    "list.createPrompt": "创建模板",
    "list.pageSummary": "第 {page} / {pageCount} 页，共 {total} 条",
    "list.variablesCount": "{count} 个变量",
    "list.versionsCount": "{count} 个版本",
    "list.representativeVersion": "版本 {version}",

    "detail.edit": "编辑",
    "detail.duplicate": "复制为新版本",
    "detail.playground": "Playground",
    "detail.activateVersion": "启用版本",
    "detail.loading": "正在加载模板...",
    "detail.notFound": "未找到模板。",
    "detail.template": "模板",
    "detail.version": "版本",
    "detail.type": "类型",
    "detail.output": "输出",
    "detail.updated": "更新时间",
    "detail.variables": "变量",
    "detail.messages": "消息模板",
    "detail.versions": "版本列表",

    "duplicate.action": "复制为新模板",
    "duplicate.title": "复制为新模板",
    "duplicate.hint": "复制当前版本 {version}，新模板将从未启用的 v1 开始。",
    "duplicate.cancel": "取消",
    "duplicate.submit": "复制模板",
    "duplicate.pending": "复制中...",
    "duplicate.invalidName": "请输入 1 到 100 个字符的模板名称。",
    "duplicate.nameTaken": "此名称已有模板，请使用其他名称。",
    "duplicate.created": "新模板已创建",
    "duplicate.failed": "复制模板失败，请重试。",

    "editor.newVersion": "新版本",
    "editor.loading": "正在加载模板...",
    "editor.loadFailed": "加载模板失败，请重试。",
    "editor.retry": "重试",
    "editor.editPrompt": "编辑模板",
    "editor.newPrompt": "新建模板",
    "editor.duplicateTitle": "复制模板",
    "editor.createTitle": "创建模板",
    "editor.editWarning": "修改内容会影响该版本。生产使用前建议复制为新版本再调整。",
    "editor.name": "模板名称",
    "editor.version": "版本",
    "editor.scenario": "业务场景",
    "editor.taskType": "任务类型",
    "editor.outputFormat": "输出格式",
    "editor.enableAfterSave": "保存后启用",
    "editor.description": "描述",
    "editor.systemPrompt": "System Prompt",
    "editor.userPrompt": "User Prompt",
    "editor.textContent": "文本模板内容",
    "editor.aiDraftTitle": "AI 生成 Prompt 草稿",
    "editor.aiDraftCopy": "根据上方已填写的模板名称、业务场景、任务类型、输出格式和描述，自动生成 system/user prompt。生成后仍可手动修改。",
    "editor.generateDraft": "AI 生成 Prompt",
    "editor.generatingDraft": "生成中...",
    "editor.overwriteDraftConfirm": "当前 system/user prompt 已有内容，AI 生成会覆盖现有文本，是否继续？",
    "editor.saveAsNewVersion": "保存为新版本",
    "editor.save": "保存",
    "editor.saving": "保存中...",
    "editor.detectedVariables": "识别到的变量",
    "editor.variableHelp": "在 Prompt 中使用 {placeholder}。变量名可以包含字母、数字和下划线。",
    "editor.messages": "Messages",

    "playground.eyebrow": "Playground",
    "playground.promptFallback": "Prompt",
    "playground.copy": "填写变量，预览 OpenAI-compatible messages，然后调用模型测试输出。",
    "playground.variables": "变量",
    "playground.generateVariables": "AI 生成测试变量",
    "playground.generatingVariables": "生成变量中...",
    "playground.generateVariablesHint": "根据当前模板场景自动生成一份可测试的变量 JSON。",
    "playground.modelTest": "模型测试",
    "playground.model": "模型",
    "playground.customModel": "自定义模型",
    "playground.customModelPlaceholder": "provider-model",
    "playground.temperature": "Temperature",
    "playground.maxTokens": "Max tokens",
    "playground.maxTokensHint": "当前模型最大输出：{limit} tokens",
    "playground.maxTokensWarning": "较大的输出上限可能导致等待时间变长、费用增加，或触发请求超时。",
    "playground.previewRender": "预览渲染",
    "playground.rendering": "渲染中...",
    "playground.testWithModel": "调用模型测试",
    "playground.testing": "测试中...",
    "playground.renderedMessages": "渲染后的 messages",
    "playground.aiOutput": "AI 输出",
    "playground.waiting": "正在等待模型响应...",
    "playground.emptyOutput": "模型输出会在测试后显示。",

    "json.objectError": "变量 JSON 必须是一个对象，例如 { \"position\": \"Java\" }",
    "json.syntaxError": "变量 JSON 格式不正确，请检查逗号、引号或括号",
    "json.missingVariables": "缺少变量：{variables}",

    "messagePreview.empty": "渲染后的 messages 会显示在这里。",
    "messagePreview.messages": "OpenAI-compatible messages",
    "messagePreview.content": "渲染后的文本",

    "variables.empty": "未识别到变量",
    "versions.empty": "暂无版本。",

    "toast.loadPromptsFailed": "加载模板列表失败",
    "toast.loadPromptFailed": "加载模板失败",
    "toast.versionActivated": "版本已启用",
    "toast.activateFailed": "启用版本失败",
    "toast.newVersionSaved": "新版本已保存",
    "toast.promptSaved": "模板已保存",
    "toast.promptCreated": "模板已创建",
    "toast.savePromptFailed": "保存模板失败",
    "toast.draftGenerated": "Prompt 草稿已生成",
    "toast.generateDraftFailed": "生成 Prompt 草稿失败",
    "toast.previewReady": "渲染预览已生成",
    "toast.previewFailed": "预览失败",
    "toast.testVariablesGenerated": "测试变量已生成",
    "toast.generateTestVariablesFailed": "生成测试变量失败",
    "toast.modelComplete": "模型测试完成",
    "toast.modelFailed": "模型测试失败",
    "toast.maxTokensExceeded": "当前模型最大输出是 {limit} tokens，请调低 Max tokens。",

    "confirm.activate": "启用该版本会停用同名模板下的其他版本，是否继续？",
    "error.missingVariables": "缺少必填变量",
    "error.requestFailed": "请求失败，状态码 {status}"
  },
  en: {
    "app.brand": "Prompt Studio",
    "app.switchTo": "中文",
    "app.languageLabel": "Switch language",

    "common.back": "Back",
    "common.backToLibrary": "Back to library",
    "common.backToPrompt": "Back to prompt",
    "common.search": "Search",
    "common.previous": "Previous",
    "common.next": "Next",
    "common.active": "Active",
    "common.inactive": "Inactive",
    "common.copy": "Copy",
    "common.open": "Open",
    "common.activate": "Activate",
    "common.loading": "Loading...",
    "common.noDescription": "No description",
    "common.copied": "Copied",

    "list.eyebrow": "Prompt Template Service",
    "list.title": "Prompt Library",
    "list.copy": "Manage versioned prompts, preview rendered messages, and test model output in one place.",
    "list.newPrompt": "New Prompt",
    "list.searchPlaceholder": "Search by name or description",
    "list.scenarioPlaceholder": "Scenario",
    "list.allStatus": "All status",
    "list.loading": "Loading prompts...",
    "list.emptyTitle": "No prompts yet",
    "list.emptyCopy": "Create the first prompt template and keep model behavior out of business code.",
    "list.createPrompt": "Create Prompt",
    "list.pageSummary": "Page {page} of {pageCount} · {total} total",
    "list.variablesCount": "{count} variables",
    "list.versionsCount": "{count} versions",
    "list.representativeVersion": "Version {version}",

    "detail.edit": "Edit",
    "detail.duplicate": "Duplicate as New Version",
    "detail.playground": "Playground",
    "detail.activateVersion": "Activate Version",
    "detail.loading": "Loading prompt...",
    "detail.notFound": "Prompt not found.",
    "detail.template": "Template",
    "detail.version": "Version",
    "detail.type": "Type",
    "detail.output": "Output",
    "detail.updated": "Updated",
    "detail.variables": "Variables",
    "detail.messages": "Messages",
    "detail.versions": "Versions",

    "duplicate.action": "Duplicate as New Template",
    "duplicate.title": "Duplicate as New Template",
    "duplicate.hint": "Copy version {version}. The new template starts as an inactive v1.",
    "duplicate.cancel": "Cancel",
    "duplicate.submit": "Duplicate Template",
    "duplicate.pending": "Duplicating...",
    "duplicate.invalidName": "Enter a template name of 1 to 100 characters.",
    "duplicate.nameTaken": "A template with this name already exists. Choose another name.",
    "duplicate.created": "New template created",
    "duplicate.failed": "Could not duplicate the template. Try again.",

    "editor.newVersion": "New version",
    "editor.loading": "Loading prompt...",
    "editor.loadFailed": "Could not load the template. Try again.",
    "editor.retry": "Retry",
    "editor.editPrompt": "Edit prompt",
    "editor.newPrompt": "New prompt",
    "editor.duplicateTitle": "Duplicate Prompt",
    "editor.createTitle": "Create Prompt",
    "editor.editWarning": "Editing changes this version. For production use, duplicate it as a new version first.",
    "editor.name": "Name",
    "editor.version": "Version",
    "editor.scenario": "Scenario",
    "editor.taskType": "Task type",
    "editor.outputFormat": "Output format",
    "editor.enableAfterSave": "Enable after save",
    "editor.description": "Description",
    "editor.systemPrompt": "System prompt",
    "editor.userPrompt": "User prompt",
    "editor.textContent": "Text template content",
    "editor.aiDraftTitle": "Generate Prompt Draft with AI",
    "editor.aiDraftCopy": "Generate system/user prompts from the name, scenario, task type, output format, and description above. You can edit the result before saving.",
    "editor.generateDraft": "Generate Prompt",
    "editor.generatingDraft": "Generating...",
    "editor.overwriteDraftConfirm": "System/user prompts already have content. AI generation will overwrite them. Continue?",
    "editor.saveAsNewVersion": "Save as New Version",
    "editor.save": "Save",
    "editor.saving": "Saving...",
    "editor.detectedVariables": "Detected variables",
    "editor.variableHelp": "Use {placeholder} in prompts. Variable names may contain letters, numbers, and underscores.",
    "editor.messages": "Messages",

    "playground.eyebrow": "Playground",
    "playground.promptFallback": "Prompt",
    "playground.copy": "Fill variables, preview OpenAI-compatible messages, then test with a model.",
    "playground.variables": "Variables",
    "playground.generateVariables": "Generate Test Variables",
    "playground.generatingVariables": "Generating variables...",
    "playground.generateVariablesHint": "Generate realistic variables JSON from the current template scenario.",
    "playground.modelTest": "Model test",
    "playground.model": "Model",
    "playground.customModel": "Custom model",
    "playground.customModelPlaceholder": "provider-model",
    "playground.temperature": "Temperature",
    "playground.maxTokens": "Max tokens",
    "playground.maxTokensHint": "Current model max output: {limit} tokens",
    "playground.maxTokensWarning": "Large output budgets can increase latency, cost, or trigger request timeouts.",
    "playground.previewRender": "Preview Render",
    "playground.rendering": "Rendering...",
    "playground.testWithModel": "Test with Model",
    "playground.testing": "Testing...",
    "playground.renderedMessages": "Rendered messages",
    "playground.aiOutput": "AI output",
    "playground.waiting": "Waiting for model response...",
    "playground.emptyOutput": "Model output will appear after testing.",

    "json.objectError": "Variables JSON must be an object, for example { \"position\": \"Java\" }",
    "json.syntaxError": "Invalid variables JSON. Check commas, quotes, or brackets.",
    "json.missingVariables": "Missing variables: {variables}",

    "messagePreview.empty": "Rendered messages will appear here.",
    "messagePreview.messages": "OpenAI-compatible messages",
    "messagePreview.content": "Rendered content",

    "variables.empty": "No variables detected",
    "versions.empty": "No versions found.",

    "toast.loadPromptsFailed": "Failed to load prompts",
    "toast.loadPromptFailed": "Failed to load prompt",
    "toast.versionActivated": "Version activated",
    "toast.activateFailed": "Failed to activate version",
    "toast.newVersionSaved": "New version saved",
    "toast.promptSaved": "Prompt saved",
    "toast.promptCreated": "Prompt created",
    "toast.savePromptFailed": "Failed to save prompt",
    "toast.draftGenerated": "Prompt draft generated",
    "toast.generateDraftFailed": "Failed to generate prompt draft",
    "toast.previewReady": "Render preview ready",
    "toast.previewFailed": "Preview failed",
    "toast.testVariablesGenerated": "Test variables generated",
    "toast.generateTestVariablesFailed": "Failed to generate test variables",
    "toast.modelComplete": "Model test complete",
    "toast.modelFailed": "Model test failed",
    "toast.maxTokensExceeded": "Current model max output is {limit} tokens. Lower Max tokens.",

    "confirm.activate": "Activating this version will deactivate other versions with the same name. Continue?",
    "error.missingVariables": "Missing required variables",
    "error.requestFailed": "Request failed with status {status}"
  }
} as const;

export type TranslationKey = keyof typeof translations.zh;

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): Language {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "zh" ? stored : "zh";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }

  function toggleLanguage() {
    setLanguage(language === "zh" ? "en" : "zh");
  }

  function t(key: TranslationKey, values?: Record<string, string | number>) {
    let text: string = translations[language][key] ?? translations.en[key] ?? key;
    if (values) {
      Object.entries(values).forEach(([name, value]) => {
        text = text.split(`{${name}}`).join(String(value));
      });
    }
    return text;
  }

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
