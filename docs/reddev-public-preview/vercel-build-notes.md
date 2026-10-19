# Vercel build integration evidence

Project `reddev-public` (`prj_R0ZKUTUfxCm227k8HI1PpfyGq0nJ`) is connected to `vidwad/LiveWell-GPLP-Model`, rooted at `reddevrei-site/`, under team `team_OTw8Nc7J80njGM7rHYYwEvYv`. Node 24, pinned pnpm 11.25.0 install/build and static `out` were accepted. The first preview `dpl_7QZfN3ihBJ3BM7sRyiWx8KUj2sqe` deployed commit `4a30b76910a142c7de475699fe3f61e5159da5e3` but failed the post-build image checks.

The logs show 63 false missing-image failures, for example `/brand/logo-wide-light.png?dpl=dpl_7QZfN3ihBJ3BM7sRyiWx8KUj2sqe`. Compilation, static page generation, route synchronization, portraits and the overlay assertions had already passed. Vercel adds a deployment-ID query to asset URLs, while the original checker treated the entire URL as a disk filename. Image validation now parses the URL and checks the local pathname; it does not disable image checks or remove Vercel's deployment query from the actual HTML.

Source: authenticated Vercel `get_deployment` and `list_deployment_events` results on 18 October 2026; official tool documentation at https://vercel.com/docs/agent-resources/vercel-mcp/tools/deployments/create_deployment . Default Vercel review authentication and noindex are retained. Existing Vercel projects, GitHub master, dashboard/backend and DNS/mail remain unchanged.
