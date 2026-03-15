import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: "Deep Focus",
    permissions: ["tabs", "tabGroups", "storage"],
    host_permissions: ["http://127.0.0.1:3456/*"],
  },
});
