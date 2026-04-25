import { AlertCircle } from "lucide-react";
import { useI18n } from "../i18n";

export function JsonEditor({
  value,
  onChange,
  error,
  missingVariables
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  missingVariables?: string[];
}) {
  const { t } = useI18n();

  return (
    <div className="json-editor">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={error || missingVariables?.length ? "field-error" : ""}
      />
      {error && (
        <div className="inline-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {!!missingVariables?.length && (
        <div className="inline-error">
          <AlertCircle size={16} />
          <span>{t("json.missingVariables", { variables: missingVariables.join(", ") })}</span>
        </div>
      )}
    </div>
  );
}
