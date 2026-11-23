// Vitest config: unit tests live next to the code they test, in src/ and scripts/; `@/` resolves to src/.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
