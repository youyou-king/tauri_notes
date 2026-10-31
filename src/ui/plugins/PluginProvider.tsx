import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  createPluginHost,
  type CommandContribution,
  type PluginActivationFailure,
  type PanelContribution,
  type PluginEntry,
  type PluginRegistry,
} from "../../kernel/plugin";
import {
  registerPanel,
  unregisterPanel,
} from "../../kernel/panel";
import { getUiRenderer } from "../../kernel/ui";
import {
  dispatchCommandEvent,
  getCommand,
  registerCommand,
  unregisterCommand,
} from "../../kernel/command";
import {
  PLUGIN_COMMAND_TIMEOUT_MS,
  withTimeout,
} from "../../kernel/command/timeout";
import { PLUGIN_ENTRIES } from "../../plugins/registry";
import {
  readDisabledPlugins,
  RESERVED_PLUGIN_IDS,
} from "./pluginPreferences";
import {
  PluginHostContext,
  type PluginHostContextValue,
} from "./pluginContext";

export {
  usePluginContributions,
  usePluginEntries,
  usePluginFailures,
  usePluginHost,
  usePluginReady,
} from "./pluginContext";

export function PluginProvider({
  children,
  entries = PLUGIN_ENTRIES,
}: {
  children: ReactNode;
  entries?: PluginEntry[];
}) {
  const hostRef = useRef<PluginRegistry | null>(null);
  const registeredCommands = useRef<string[]>([]);
  const registeredPanels = useRef<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [failures, setFailures] = useState<PluginActivationFailure[]>([]);
  if (!hostRef.current) {
    const disabled = readDisabledPlugins();
    hostRef.current = createPluginHost(
      entries.filter(
        (entry) =>
          RESERVED_PLUGIN_IDS.has(entry.manifest.id) ||
          !disabled.has(entry.manifest.id),
      ),
    );
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    let cancelled = false;
    void host
      .startSafely()
      .then((activationFailures) => {
        if (cancelled) {
          return;
        }
        setFailures(activationFailures);
        const commands = host.getContributions(
          "commands",
        ) as CommandContribution[];
        const registered: string[] = [];
        for (const command of commands) {
          // Core/app commands win over metadata-only plugin commands.
          if (getCommand(command.id)) {
            continue;
          }
          registerCommand({
            id: command.id,
            label: command.label,
            shortcut: command.shortcut,
            run: (context) =>
              withTimeout(
                Promise.resolve().then(() =>
                  command.run
                    ? command.run(context)
                    : dispatchCommandEvent(command.id),
                ),
                PLUGIN_COMMAND_TIMEOUT_MS,
                `插件命令 ${command.id} `,
              ),
          });
          registered.push(command.id);
        }
        registeredCommands.current = registered;

        const panels = host.getContributions(
          "panels",
        ) as PanelContribution[];
        const panelIds: string[] = [];
        for (const panel of panels) {
          const component = getUiRenderer(panel.renderer);
          if (!component) {
            console.warn(
              `panel renderer missing: ${panel.renderer} (${panel.id})`,
            );
            continue;
          }
          registerPanel({
            id: panel.id,
            component,
            icon: panel.icon ?? "▦",
            defaultTitle: panel.title,
            singleton: panel.singleton,
          });
          panelIds.push(panel.id);
        }
        registeredPanels.current = panelIds;
        setRevision((current) => current + 1);
      })
      .catch((error) => console.error("plugin start failed", error));
    return () => {
      cancelled = true;
      for (const id of registeredCommands.current) {
        unregisterCommand(id);
      }
      registeredCommands.current = [];
      for (const id of registeredPanels.current) {
        unregisterPanel(id);
      }
      registeredPanels.current = [];
      void host.stop();
    };
  }, []);

  const value = useMemo<PluginHostContextValue>(
    () => ({
      host: hostRef.current as PluginRegistry,
      revision,
      entries,
      failures,
    }),
    [entries, failures, revision],
  );

  return (
    <PluginHostContext.Provider value={value}>
      {children}
    </PluginHostContext.Provider>
  );
}


