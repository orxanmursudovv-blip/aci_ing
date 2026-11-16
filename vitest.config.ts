import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    fileParallelism: false,
    env: { TZ: "America/New_York" }, // serverin öz vaxt qurşağına bağlı olmadığımızı yoxlayır
  },
});
