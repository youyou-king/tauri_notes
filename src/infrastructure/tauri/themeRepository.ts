import { command } from "./client";

export const themeRepository = {
  list(): Promise<string[]> {
    return command("list_custom_themes");
  },

  save(id: string, json: string): Promise<void> {
    return command("save_custom_theme", { id, json });
  },

  delete(id: string): Promise<void> {
    return command("delete_custom_theme", { id });
  },
};
