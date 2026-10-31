import type { PluginEntry } from "../kernel/plugin";
import { boardFeature } from "./board/manifest";
import { boardPlugin } from "./board";
import { referenceFeature } from "./reference/manifest";
import { referencePlugin } from "./reference";
import { themeFeature } from "./theme/manifest";
import { themePlugin } from "./theme";
import { searchFeature } from "./search/manifest";
import { searchPlugin } from "./search";
import { helpFeature } from "./help/manifest";
import { helpPlugin } from "./help";
import { importFeature } from "./import/manifest";
import { importPlugin } from "./import";
import { viewportFeature } from "./viewport/manifest";
import { viewportPlugin } from "./viewport";

/**
 * Compile-time plugin registry. The host must stay generic; adding a plugin
 * changes this file, not PluginProvider or the kernel.
 */
export const PLUGIN_ENTRIES: PluginEntry[] = [
  {
    manifest: themeFeature,
    createModule: () => themePlugin,
  },
  {
    manifest: boardFeature,
    createModule: () => boardPlugin,
  },
  {
    manifest: referenceFeature,
    createModule: () => referencePlugin,
  },
  {
    manifest: searchFeature,
    createModule: () => searchPlugin,
  },
  {
    manifest: helpFeature,
    createModule: () => helpPlugin,
  },
  {
    manifest: importFeature,
    createModule: () => importPlugin,
  },
  {
    manifest: viewportFeature,
    createModule: () => viewportPlugin,
  },
];
