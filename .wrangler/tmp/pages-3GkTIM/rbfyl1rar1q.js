// <define:__ROUTES__>
var define_ROUTES_default = {
  version: 1,
  include: ["/*"],
  exclude: []
};

// ../../../tmp/claude-0/-home-user/6ca00525-99ca-5dee-8001-26f247bb52cf/scratchpad/wr/node_modules/wrangler/templates/pages-dev-pipeline.ts
import worker from "/home/user/revision-hub/.wrangler/tmp/pages-3GkTIM/functionsWorker-0.09749357073798248.mjs";
import { isRoutingRuleMatch } from "/tmp/claude-0/-home-user/6ca00525-99ca-5dee-8001-26f247bb52cf/scratchpad/wr/node_modules/wrangler/templates/pages-dev-util.ts";
export * from "/home/user/revision-hub/.wrangler/tmp/pages-3GkTIM/functionsWorker-0.09749357073798248.mjs";
var routes = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = worker;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  pages_dev_pipeline_default as default
};
//# sourceMappingURL=rbfyl1rar1q.js.map
