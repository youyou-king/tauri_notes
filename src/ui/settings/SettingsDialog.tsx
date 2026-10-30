import { useMemo, useState } from "react";
import type { SettingsSectionContribution } from "../../kernel/plugin";
import { Dialog } from "../dialog/Dialog";
import { usePluginContributions } from "../plugins/PluginProvider";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const sections = usePluginContributions<SettingsSectionContribution>(
    "settingsSections",
  )
    .filter((section) => section.component)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const initial = sections[0]?.id ?? "";
  const [activeId, setActiveId] = useState(initial);
  const active = useMemo(
    () => sections.find((section) => section.id === activeId) ?? sections[0],
    [activeId, sections],
  );
  const Component = active?.component;

  return (
    <Dialog
      title="设置"
      description="由功能插件提供的设置区"
      onClose={onClose}
      width={760}
      footer={
        <button type="button" className="primary" onClick={onClose}>
          完成
        </button>
      }
    >
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分类">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={section.id === active?.id ? "active" : ""}
              onClick={() => setActiveId(section.id)}
            >
              {section.title}
            </button>
          ))}
        </nav>
        <section className="settings-section">
          {Component ? <Component /> : <p>没有可用的设置项。</p>}
        </section>
      </div>
    </Dialog>
  );
}
