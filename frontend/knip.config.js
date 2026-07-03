/** @import {KnipConfig} from "knip" */

/** @type {KnipConfig} */
const config = {
  workspaces: {
    '.': {
      entry: ['./app/.server/express-server/opentelemetry.ts', './app/.server/express-server/express.ts'],
    },
  },
};

export default config;
