import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

/**
 * This file is used separately from `vite.config.ts` to build the server
 * runtime that bootstraps the application.
 *
 * While `vite.config.ts` is typically focused on the react-router application
 * build, this configuration is tailored specifically for building the server
 * runtime, ensuring optimized deployment for Node.js.
 */

export default defineConfig({
  build: {
    // Disable copying the `public` directory, as it is not needed for the server runtime.
    copyPublicDir: false,

    // Prevent Vite from clearing the `outDir` before building. This ensures that other assets
    // (e.g., client-side builds) remain intact in the `./build` directory.
    emptyOutDir: false,

    // Specifies the output directory for the server build.
    outDir: './build/server/',

    rolldownOptions: {
      // Specifies the entry point for the server runtime.
      // This is the TypeScript file that Vite will start building from.
      input: ['./app/.server/express-server/opentelemetry.ts', './app/.server/express-server/server.ts'],
    },

    // Enables Server-Side Rendering (SSR) mode, optimizing the build process for Node.js.
    ssr: true,

    // Specifies the Node.js version compatibility for the generated output.
    // Setting `target: 'node26'` ensures compatibility with Node.js 26, enabling
    // features like ES modules, top-level await, and modern JavaScript syntax.
    target: 'node26',
  },
  plugins: [copyServerAssets()],
  resolve: {
    // Ensures that Vite can resolve TypeScript path aliases defined in `tsconfig.json`.
    // This is crucial for maintaining clean and manageable import paths in the server code.
    tsconfigPaths: true,
  },
});

/**
 * Creates a Vite plugin to copy server assets (e.g. error pages) to the build output directory
 * during the build process to ensure our static assets end up where they belong in the final build.
 */
function copyServerAssets(): Plugin {
  return {
    name: 'copy-server-assets',
    closeBundle() {
      const srcDir = './app/.server/express-server/assets';
      const destDir = './build/server/assets/';

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const files = fs.readdirSync(srcDir);

      for (const file of files) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
        console.log(`[copy-server-assets] Copied ${file} to build/server/assets/`);
      }
    },
  };
}
