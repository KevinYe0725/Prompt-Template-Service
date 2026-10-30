import type {
  PromptCreateRequest,
  PromptDraftGenerateRequest,
  PromptDraftGenerateResponse,
  PromptListResponse,
  PromptRenderRequest,
  PromptRenderResponse,
  PromptTemplate,
  PromptTemplateListItem,
  PromptTestRequest,
  PromptTestResponse,
  PromptTestVariablesGenerateRequest,
  PromptTestVariablesGenerateResponse,
  PromptUpdateRequest,
  PromptVersionCreateRequest
} from "../types/prompt";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

type QueryValue = string | number | boolean | undefined | null;

export class PromptApiError extends Error {
  status: number;
  detail: unknown;
  missingVariables: string[];

  constructor(status: number, detail: unknown) {
    const message =
      typeof detail === "string"
        ? detail
        : typeof detail === "object" && detail && "message" in detail
          ? String((detail as { message: unknown }).message)
          : `Request failed with status ${status}`;
    super(message);
    this.name = "PromptApiError";
    this.status = status;
    this.detail = detail;
    this.missingVariables =
      typeof detail === "object" && detail && "missing_variables" in detail
        ? ((detail as { missing_variables?: string[] }).missing_variables ?? [])
        : [];
  }
}

function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new PromptApiError(response.status, data?.detail ?? data);
  }
  return data as T;
}

export const promptApi = {
  listPrompts(params: {
    keyword?: string;
    scenario?: string;
    task_type?: string;
    enabled?: boolean | "";
    page?: number;
    page_size?: number;
  }) {
    return request<PromptListResponse>(`/api/prompts${buildQuery(params)}`);
  },

  getPrompt(id: number) {
    return request<PromptTemplate>(`/api/prompts/${id}`);
  },

  createPrompt(data: PromptCreateRequest) {
    return request<PromptTemplate>("/api/prompts", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  generatePromptDraft(data: PromptDraftGenerateRequest) {
    return request<PromptDraftGenerateResponse>("/api/prompts/generate-draft", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  updatePrompt(id: number, data: PromptUpdateRequest) {
    return request<PromptTemplate>(`/api/prompts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  createPromptVersion(id: number, data: PromptVersionCreateRequest) {
    return request<PromptTemplate>(`/api/prompts/${id}/versions`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  duplicatePrompt(id: number, name: string) {
    return request<PromptTemplate>(`/api/prompts/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  activatePrompt(id: number) {
    return request<{ success: boolean; active_template_id: number; name: string; version: string }>(
      `/api/prompts/${id}/activate`,
      { method: "POST" }
    );
  },

  previewPrompt(id: number, variables: Record<string, unknown>) {
    return request<PromptRenderResponse>(`/api/prompts/${id}/preview`, {
      method: "POST",
      body: JSON.stringify({ variables })
    });
  },

  renderPrompt(data: PromptRenderRequest) {
    return request<PromptRenderResponse>("/api/prompts/render", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  testPrompt(id: number, data: PromptTestRequest) {
    return request<PromptTestResponse>(`/api/prompts/${id}/test`, {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  generateTestVariables(id: number, data: PromptTestVariablesGenerateRequest) {
    return request<PromptTestVariablesGenerateResponse>(
      `/api/prompts/${id}/generate-test-variables`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    );
  },

  listPromptVersions(id: number) {
    return request<PromptTemplateListItem[]>(`/api/prompts/${id}/versions`);
  }
};
