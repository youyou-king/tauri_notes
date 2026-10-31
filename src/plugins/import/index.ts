import { lazy, type ComponentType } from "react";
import type {
  PluginModule,
  UiRendererProps,
} from "../../kernel/sdk";
import {
  registerUiRenderer,
  unregisterUiRenderer,
} from "../../kernel/sdk";

const ImportedPreviewPane = lazy(
  () => import("./ui/ImportedPreviewPane"),
);

export const importPlugin: PluginModule = {
  activate: () => {
    registerUiRenderer(
      "document.importedView",
      ImportedPreviewPane as unknown as ComponentType<
        UiRendererProps["document.importedView"]
      >,
    );
  },
  deactivate: () => {
    unregisterUiRenderer("document.importedView");
  },
};
