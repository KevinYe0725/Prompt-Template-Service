import { Copy } from "lucide-react";
import { useI18n } from "../i18n";
import type { PromptMessage } from "../types/prompt";

export function MessagePreview({
  messages,
  content,
  onCopy
}: {
  messages?: PromptMessage[] | null;
  content?: string | null;
  onCopy?: (value: string) => void;
}) {
  const { t } = useI18n();
  const value = messages ? JSON.stringify(messages, null, 2) : content ?? "";

  if (!messages?.length && !content) {
    return <div className="empty-panel">{t("messagePreview.empty")}</div>;
  }

  return (
    <div className="message-preview">
      <div className="preview-toolbar">
        <span>{messages ? t("messagePreview.messages") : t("messagePreview.content")}</span>
        {onCopy && (
          <button className="icon-button" type="button" onClick={() => onCopy(value)} title={t("common.copy")}>
            <Copy size={16} />
          </button>
        )}
      </div>
      {messages ? (
        <div className="message-list">
          {messages.map((message, index) => (
            <div className="message-block" key={`${message.role}-${index}`}>
              <div className="message-role">{message.role}</div>
              <pre>{message.content}</pre>
            </div>
          ))}
        </div>
      ) : (
        <pre className="code-block">{content}</pre>
      )}
    </div>
  );
}
