import type { ManagedLibrarySummary } from "../../application/managedLibraryService";
import { SurfaceHeader } from "../design-system/SurfaceHeader";
import { ModalSurface } from "../dialog/ModalSurface";
import { MobileManagedLibraries } from "./MobileManagedLibraries";

export function MobileLibraryManager({
  libraries,
  workspaceId,
  onOpen,
  onImport,
  onShare,
  onExport,
  onClose,
}: {
  libraries: ManagedLibrarySummary[];
  workspaceId: string;
  onOpen: (path: string) => void;
  onImport: () => void;
  onShare: (item: ManagedLibrarySummary) => void;
  onExport: (item: ManagedLibrarySummary) => void;
  onClose: () => void;
}) {
  return (
    <ModalSurface
      className="mobile-library-manager-backdrop"
      panelClassName="mobile-library-manager"
      ariaLabel="知识库管理"
      onClose={onClose}
    >
      <SurfaceHeader
        className="mobile-library-manager-header"
        title="知识库"
        subtitle="打开、导入或备份本机知识库"
        onClose={onClose}
        closeLabel="关闭知识库管理"
        closeClassName="mobile-library-manager-close"
      />
      <MobileManagedLibraries
        libraries={libraries}
        workspaceId={workspaceId}
        onOpen={(path) => {
          onClose();
          onOpen(path);
        }}
        onImport={onImport}
        onShare={onShare}
        onExport={onExport}
      />
    </ModalSurface>
  );
}
