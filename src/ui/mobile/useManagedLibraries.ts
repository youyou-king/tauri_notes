import { useCallback, useEffect, useState } from "react";
import type { DialogPort } from "../../application/ports/dialogPort";
import type { LibraryPort } from "../../application/ports/libraryPort";
import {
  managedLibraryService,
  type ManagedLibrarySummary,
} from "../../application/managedLibraryService";
import { runLibraryAction } from "../../app/libraryActions";
import { asLibraryPath } from "../../types";
import { message } from "../design-system/Message";

/**
 * Owns the mobile managed-library list and its lifecycle operations. The shell
 * only wires the returned state into presentation and provides workspace
 * navigation; it does not know how managed files are stored or deleted.
 */
export function useManagedLibraries({
  open,
  workspaceId,
  library,
  dialogs,
  onOpenPath,
}: {
  open: boolean;
  workspaceId: string | null;
  library: LibraryPort;
  dialogs: DialogPort;
  onOpenPath?: (path: string) => void;
}) {
  const [libraries, setLibraries] = useState<ManagedLibrarySummary[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    void managedLibraryService
      .list()
      .then((items) => {
        if (!cancelled) {
          setLibraries(Array.isArray(items) ? items : []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLibraries([]);
          message.error(String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  const deleteLibrary = useCallback(
    async (item: ManagedLibrarySummary) => {
      if (item.id === workspaceId) {
        message.warning("当前打开的知识库不能删除，请先打开其他知识库。");
        return;
      }
      const confirmed = await dialogs.confirm({
        title: "删除知识库？",
        message: `将永久删除“${item.title}”及其本机数据，此操作不可撤销。`,
        confirmLabel: "删除",
        tone: "danger",
      });
      if (!confirmed) {
        return;
      }
      try {
        await managedLibraryService.delete(item.path);
        setLibraries((current) =>
          current.filter((library) => library.path !== item.path),
        );
        message.success(`已删除 ${item.title}`);
      } catch (error) {
        message.error(String(error));
      }
    },
    [dialogs, workspaceId],
  );

  const exportLibrary = useCallback(
    async (item: ManagedLibrarySummary) => {
      try {
        await runLibraryAction("library.export", {
          platform: "mobile",
          library,
          source: asLibraryPath(item.path),
          onExported: (path) => message.success(`已导出到 ${path}`),
        });
      } catch (error) {
        message.error(String(error));
      }
    },
    [library],
  );

  const importLibrary = useCallback(async () => {
    try {
      await runLibraryAction("library.import", {
        platform: "mobile",
        library,
        onImported: (path) => onOpenPath?.(path),
      });
    } catch (error) {
      message.error(String(error));
    }
  }, [library, onOpenPath]);

  return {
    libraries,
    deleteLibrary,
    exportLibrary,
    importLibrary,
  };
}
