/** @import {KnipConfig} from "knip" */

/** @type {KnipConfig} */
const config = {
  workspaces: {
    '.': {
      entry: ['./app/.server/express-server/opentelemetry.ts', './app/.server/express-server/server.ts'],
    },
  },
};

export default config;
