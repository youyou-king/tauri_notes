export type OpenRequestSource =
  | "cli"
  | "single-instance"
  | "file-association"
  | "drop"
  | "dialog";

export type OpenRequest = {
  kind: "note" | "workspace";
  path: string;
  source: OpenRequestSource;
};

export function noteOpenRequest(
  path: string,
  source: OpenRequestSource = "single-instance",
): OpenRequest {
  return { kind: "note", path, source };
}

export function workspaceOpenRequest(
  path: string,
  source: OpenRequestSource = "dialog",
): OpenRequest {
  return { kind: "workspace", path, source };
}

export function openRequestPath(request: OpenRequest): string {
  return request.path;
}
