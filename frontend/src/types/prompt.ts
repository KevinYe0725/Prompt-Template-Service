export type PromptMessage = {
  role: "system" | "user" | "assistant" | "tool" | string;
  content: string;
  [key: string]: unknown;
};

export type PromptTemplate = {
  id: number;
  name: string;
  version: string;
  scenario: string;
  task_type: string;
  template_type: "chat" | "text";
  content?: string | null;
  messages?: PromptMessage[] | null;
  variables: string[];
  output_format: "text" | "json" | "markdown";
  enabled: boolean;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type PromptTemplateListItem = Omit<
  PromptTemplate,
  "content" | "messages" | "created_by" | "created_at"
> & {
  versions_count: number;
};

export type PromptListResponse = {
  items: PromptTemplateListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type PromptCreateRequest = {
  name: string;
  version: string;
  scenario: string;
  task_type: string;
  template_type: "chat" | "text";
  content?: string | null;
  messages?: PromptMessage[] | null;
  output_format: "text" | "json" | "markdown";
  enabled?: boolean;
  description?: string | null;
};

export type PromptUpdateRequest = Partial<
  Pick<
    PromptCreateRequest,
    "scenario" | "task_type" | "template_type" | "content" | "messages" | "output_format" | "description"
  >
>;

export type PromptVersionCreateRequest = {
  version: string;
  content?: string | null;
  messages?: PromptMessage[] | null;
  description?: string | null;
  enabled?: boolean;
};

export type PromptRenderRequest = {
  name: string;
  version?: string;
  variables: Record<string, unknown>;
};

export type PromptRenderResponse = {
  template_id: number;
  name: string;
  version: string;
  template_type: "chat" | "text";
  content?: string | null;
  messages?: PromptMessage[] | null;
  variables: Record<string, unknown>;
};

export type PromptTestRequest = {
  variables: Record<string, unknown>;
  model?: string | null;
  temperature: number;
  max_tokens: number;
};

export type PromptTestResponse = {
  template_id: number;
  name: string;
  version: string;
  rendered_messages: PromptMessage[];
  model: string;
  ai_response: string;
  latency_ms: number;
};

export type PromptDraftGenerateRequest = {
  name: string;
  scenario: string;
  task_type: string;
  output_format: "text" | "json" | "markdown";
  description?: string | null;
  existing_system_prompt?: string | null;
  existing_user_prompt?: string | null;
  language?: "zh" | "en";
  model?: string | null;
  temperature?: number;
  max_tokens?: number;
};

export type PromptDraftGenerateResponse = {
  system_prompt: string;
  user_prompt: string;
  variables: string[];
  model: string;
  latency_ms: number;
};

export type PromptTestVariablesGenerateRequest = {
  language?: "zh" | "en";
  model?: string | null;
  temperature?: number;
  max_tokens?: number;
};

export type PromptTestVariablesGenerateResponse = {
  variables: Record<string, unknown>;
  model: string;
  latency_ms: number;
};
