import { defineConfig } from "vitest/config";

export default defineConfig({
  // Studio and Extension install separately. UI tests must share one React runtime.
  resolve: { dedupe: ["react", "react-dom"] }
});
