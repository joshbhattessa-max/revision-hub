import { onRequest as __api_admin___route___js_onRequest } from "/home/user/revision-hub/functions/api/admin/[[route]].js"
import { onRequestGet as __api_hub_js_onRequestGet } from "/home/user/revision-hub/functions/api/hub.js"
import { onRequestPost as __api_login_js_onRequestPost } from "/home/user/revision-hub/functions/api/login.js"
import { onRequestPost as __api_logout_js_onRequestPost } from "/home/user/revision-hub/functions/api/logout.js"
import { onRequestGet as __api_me_js_onRequestGet } from "/home/user/revision-hub/functions/api/me.js"
import { onRequestPost as __api_signup_js_onRequestPost } from "/home/user/revision-hub/functions/api/signup.js"
import { onRequestGet as __media__id__js_onRequestGet } from "/home/user/revision-hub/functions/media/[id].js"
import { onRequest as ____path___js_onRequest } from "/home/user/revision-hub/functions/[[path]].js"
import { onRequest as ___middleware_js_onRequest } from "/home/user/revision-hub/functions/_middleware.js"

export const routes = [
    {
      routePath: "/api/admin/:route*",
      mountPath: "/api/admin",
      method: "",
      middlewares: [],
      modules: [__api_admin___route___js_onRequest],
    },
  {
      routePath: "/api/hub",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_hub_js_onRequestGet],
    },
  {
      routePath: "/api/login",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_login_js_onRequestPost],
    },
  {
      routePath: "/api/logout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_logout_js_onRequestPost],
    },
  {
      routePath: "/api/me",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_me_js_onRequestGet],
    },
  {
      routePath: "/api/signup",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_signup_js_onRequestPost],
    },
  {
      routePath: "/media/:id",
      mountPath: "/media",
      method: "GET",
      middlewares: [],
      modules: [__media__id__js_onRequestGet],
    },
  {
      routePath: "/:path*",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [____path___js_onRequest],
    },
  {
      routePath: "/",
      mountPath: "/",
      method: "",
      middlewares: [___middleware_js_onRequest],
      modules: [],
    },
  ]