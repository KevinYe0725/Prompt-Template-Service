import { FormEvent, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { promptApi } from "../api/promptApi";
import { PromptCard } from "../components/PromptCard";
import type { PromptTemplateListItem } from "../types/prompt";
import { useToast } from "../components/ToastProvider";
import { useI18n } from "../i18n";

export function PromptListPage({ navigate }: { navigate: (path: string) => void }) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [items, setItems] = useState<PromptTemplateListItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [scenario, setScenario] = useState("");
  const [enabled, setEnabled] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const result = await promptApi.listPrompts({
        keyword,
        scenario,
        enabled: enabled === "" ? "" : enabled === "true",
        page,
        page_size: 10
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("toast.loadPromptsFailed"), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, enabled]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void load();
  }

  const pageCount = Math.max(Math.ceil(total / 10), 1);

  return (
    <main className="page-shell">
      <section className="page-hero">
        <div>
          <p className="eyebrow">{t("list.eyebrow")}</p>
          <h1>{t("list.title")}</h1>
          <p className="hero-copy">
            {t("list.copy")}
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => navigate("/admin/prompts/new")}>
          <Plus size={18} />
          {t("list.newPrompt")}
        </button>
      </section>

      <section className="glass-panel">
        <form className="filter-bar" onSubmit={handleSearch}>
          <label className="search-field">
            <Search size={18} />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t("list.searchPlaceholder")}
            />
          </label>
          <input
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            placeholder={t("list.scenarioPlaceholder")}
          />
          <select value={enabled} onChange={(event) => setEnabled(event.target.value as "" | "true" | "false")}>
            <option value="">{t("list.allStatus")}</option>
            <option value="true">{t("common.active")}</option>
            <option value="false">{t("common.inactive")}</option>
          </select>
          <button className="secondary-button" type="submit">
            {t("common.search")}
          </button>
        </form>

        {loading ? (
          <div className="empty-panel">{t("list.loading")}</div>
        ) : items.length ? (
          <div className="prompt-grid">
            {items.map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} onOpen={(id) => navigate(`/admin/prompts/${id}`)} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>{t("list.emptyTitle")}</h2>
            <p>{t("list.emptyCopy")}</p>
            <button className="primary-button" type="button" onClick={() => navigate("/admin/prompts/new")}>
              <Plus size={18} />
              {t("list.createPrompt")}
            </button>
          </div>
        )}

        <div className="pagination">
          <span>
            {t("list.pageSummary", { page, pageCount, total })}
          </span>
          <div>
            <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t("common.previous")}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
