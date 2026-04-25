import { useI18n } from "../i18n";

export function VariableChips({ variables }: { variables: string[] }) {
  const { t } = useI18n();

  if (!variables.length) {
    return <div className="muted small">{t("variables.empty")}</div>;
  }

  return (
    <div className="chips">
      {variables.map((variable) => (
        <span className="chip" key={variable}>
          {variable}
        </span>
      ))}
    </div>
  );
}
