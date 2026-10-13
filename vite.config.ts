import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        todo: fileURLToPath(new URL("./todo.html", import.meta.url)),
        reminder: fileURLToPath(new URL("./reminder.html", import.meta.url)),
      },
    },
  },
});
