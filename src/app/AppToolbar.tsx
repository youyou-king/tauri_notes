import type { Dispatch, SetStateAction } from "react";
import { ThemeMenu } from "../ui/theme/ThemeMenu";

export type NavbarMenu = "knowledge" | "view" | "theme" | null;

type Props = {
  backend: string;
  busy: boolean;
  hasWorkspace: boolean;
  menu: NavbarMenu;
  setMenu: Dispatch<SetStateAction<NavbarMenu>>;
  runCommand: (id: string) => void;
};

export function AppToolbar({
  backend,
  busy,
  hasWorkspace,
  menu,
  setMenu,
  runCommand,
}: Props) {
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">N</span>
        <span>Notes</span>
      </div>
      <div className="toolbar-menus">
        <div className="toolbar-menu">
          <button
            type="button"
            className={menu === "knowledge" ? "active" : ""}
            onClick={() =>
              setMenu((current) =>
                current === "knowledge" ? null : "knowledge",
              )
            }
          >
            知识库 ▾
          </button>
          {menu === "knowledge" && (
            <div className="toolbar-popover">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMenu(null);
                  runCommand("knowledge.create");
                }}
              >
                新建知识库…
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMenu(null);
                  runCommand("knowledge.open");
                }}
              >
                打开知识库…
              </button>
              <button
                type="button"
                disabled={busy || !hasWorkspace}
                onClick={() => {
                  setMenu(null);
                  runCommand("knowledge.backup");
                }}
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  runCommand("association.set");
                }}
              >
                设置 .note 文件关联
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  runCommand("association.clear");
                }}
              >
                清除 .note 文件关联
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-menu">
          <button
            type="button"
            className={menu === "view" ? "active" : ""}
            onClick={() =>
              setMenu((current) => (current === "view" ? null : "view"))
            }
          >
            视图 ▾
          </button>
          {menu === "view" && (
            <div className="toolbar-popover">
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  runCommand("view.outline");
                }}
              >
                大纲
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  runCommand("view.console");
                }}
              >
                控制台
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  runCommand("view.reset-layout");
                }}
              >
                重置布局
              </button>
            </div>
          )}
        </div>

        <div className="toolbar-menu">
          <button
            type="button"
            className={menu === "theme" ? "active" : ""}
            onClick={() =>
              setMenu((current) => (current === "theme" ? null : "theme"))
            }
          >
            主题 ▾
          </button>
          {menu === "theme" && <ThemeMenu onClose={() => setMenu(null)} />}
        </div>

        <button
          type="button"
          className="toolbar-help"
          disabled={busy}
          onClick={() => {
            setMenu(null);
            runCommand("help.open");
          }}
        >
          帮助
        </button>
      </div>
      <div
        className={`backend ${
          backend.startsWith("未") ? "offline" : "online"
        }`}
      >
        {backend}
      </div>
    </header>
  );
}
