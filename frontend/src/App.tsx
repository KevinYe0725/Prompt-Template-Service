import { useEffect, useMemo, useState } from "react";
import { Database, Languages, Library } from "lucide-react";
import { ToastProvider } from "./components/ToastProvider";
import { I18nProvider, useI18n } from "./i18n";
import { PromptDetailPage } from "./pages/PromptDetailPage";
import { PromptEditorPage } from "./pages/PromptEditorPage";
import { PromptListPage } from "./pages/PromptListPage";
import { PromptPlaygroundPage } from "./pages/PromptPlaygroundPage";

function useLocationPath() {
  const [path, setPath] = useState(window.location.pathname + window.location.search);

  useEffect(() => {
    function handlePopState() {
      setPath(window.location.pathname + window.location.search);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextPath: string) {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return { path, navigate };
}

function AppContent() {
  const { path, navigate } = useLocationPath();
  const { t, toggleLanguage } = useI18n();

  const route = useMemo(() => {
    const url = new URL(path, window.location.origin);
    const pathname = url.pathname;
    if (pathname === "/" || pathname === "/admin/prompts") {
      return <PromptListPage navigate={navigate} />;
    }
    if (pathname === "/admin/prompts/new") {
      return <PromptEditorPage navigate={navigate} />;
    }
    const match = pathname.match(/^\/admin\/prompts\/(\d+)(?:\/(edit|playground))?$/);
    if (match) {
      const id = Number(match[1]);
      const action = match[2];
      if (action === "edit") {
        return (
          <PromptEditorPage
            id={id}
            duplicate={url.searchParams.get("newVersion") === "1"}
            navigate={navigate}
          />
        );
      }
      if (action === "playground") {
        return <PromptPlaygroundPage id={id} navigate={navigate} />;
      }
      return <PromptDetailPage id={id} navigate={navigate} />;
    }
    return <PromptListPage navigate={navigate} />;
  }, [path, navigate]);

  return (
    <>
      <nav className="top-nav">
        <button className="brand" type="button" onClick={() => navigate("/admin/prompts")}>
          <Library size={20} />
          <span>{t("app.brand")}</span>
        </button>
        <div className="nav-actions">
          <button
            className="language-toggle"
            type="button"
            onClick={toggleLanguage}
            aria-label={t("app.languageLabel")}
          >
            <Languages size={16} />
            <span>{t("app.switchTo")}</span>
          </button>
          <div className="nav-pill">
            <Database size={15} />
            <span>/api/prompts</span>
          </div>
        </div>
      </nav>
      {route}
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </I18nProvider>
  );
}
