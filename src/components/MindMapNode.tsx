import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type MindMapNodeData = {
  label: string;
  hasDocument: boolean;
  documentId: string | null;
  isRoot: boolean;
  selected: boolean;
  nodeId: string;
  nodeTitle: string;
  onRename: (nodeId: string, title: string) => void;
};

type MindMapFlowNode = Node<MindMapNodeData, "mindMap">;

function MindMapNode({ data }: NodeProps<MindMapFlowNode>) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(data.nodeTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    setValue(data.nodeTitle);
  }, [data.nodeTitle]);

  useEffect(() => {
    if (editing) {
      return;
    }
    const element = bodyRef.current;
    if (!element) {
      return;
    }
    const startEditing = () => {
      setValue(data.nodeTitle);
      setEditing(true);
    };
    element.addEventListener("dblclick", startEditing);
    return () => element.removeEventListener("dblclick", startEditing);
  }, [editing, data.nodeTitle]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ nodeId?: string }>).detail;
      if (detail?.nodeId === data.nodeId) {
        setValue(data.nodeTitle);
        setEditing(true);
      }
    };
    window.addEventListener("mind-map:rename", handler);
    return () => window.removeEventListener("mind-map:rename", handler);
  }, [data.nodeId, data.nodeTitle]);

  const commit = () => {
    const next = value.trim();
    setEditing(false);
    if (next && next !== data.nodeTitle) {
      data.onRename(data.nodeId, next);
    } else {
      setValue(data.nodeTitle);
    }
  };

  if (editing) {
    return (
      <div className="mind-map-node-body">
        <input
          ref={inputRef}
          className="mind-map-node-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            } else if (event.key === "Escape") {
              setValue(data.nodeTitle);
              setEditing(false);
            }
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        />
        <Handle type="target" position={Position.Top} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  return (
    <div
      ref={bodyRef}
      className="mind-map-node-body"
      onDoubleClick={(event) => {
        event.stopPropagation();
        setValue(data.nodeTitle);
        setEditing(true);
      }}
      title="双击重命名"
    >
      {data.hasDocument && (
        <span
          className="mind-map-node-doc"
          title="打开文档"
          onClick={(event) => {
            event.stopPropagation();
            if (data.documentId) {
              window.dispatchEvent(
                new CustomEvent("mind-map:open-document", {
                  detail: { documentId: data.documentId },
                }),
              );
            }
          }}
        >
          📄
        </span>
      )}
      <span className="mind-map-node-label">{data.label}</span>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default memo(MindMapNode);
