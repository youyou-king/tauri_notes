import { useEffect, useState } from "react";
import { associationService } from "../../application/associationService";

export function FileAssociationSection() {
  const [associated, setAssociated] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void associationService
      .status()
      .then((value) => {
        if (active) {
          setAssociated(value);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(String(reason));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (next) {
        await associationService.register();
      } else {
        await associationService.unregister();
      }
      setAssociated(next);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-form">
      <h3>文件关联</h3>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={associated === true}
          disabled={busy || associated === null}
          onChange={(event) => void toggle(event.currentTarget.checked)}
        />
        <span className="settings-toggle-copy">
          <strong>.note 文件</strong>
          <small>使用 Tauri Notes 打开 .note 知识库</small>
        </span>
      </label>
      {associated === null && !error && (
        <p className="settings-status">正在读取文件关联…</p>
      )}
      {error && <p className="settings-status error">{error}</p>}
    </div>
  );
}