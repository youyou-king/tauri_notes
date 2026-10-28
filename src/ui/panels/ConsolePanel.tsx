import { PanelShell } from "./PanelShell";
import { usePanelContext } from "./PanelContext";

export function ConsolePanel() {
  const context = usePanelContext();
  if (!context) {
    return null;
  }
  return (
    <PanelShell
      className="console-panel"
      bodyClassName="console-body"
      title="控制台"
      icon="⌨"
      status="就绪"
    >
      <div className="console-lines">
        {context.logs.map((line, index) => (
          <div key={index} className="console-line">
            <span className="console-prompt">›</span> {line}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
