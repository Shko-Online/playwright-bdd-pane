# Playwright BDD Report: Azure DevOps extension

Publish [playwright-bdd](https://vitalets.github.io/playwright-bdd/) HTML reports from Azure Pipelines and review them in a **Playwright BDD** tab on the run page. Reviewers don't need to download anything. User-facing docs live in [overview.md](overview.md), which is also the Marketplace page.

## How it works

```
 pipeline agent                                   browser (run page → "Playwright BDD" tab)
┌──────────────────────────────┐                 ┌───────────────────────────────────────────────┐
│ PublishPlaywrightBddReport@1 │                 │ tab.html (extension iframe)                   │
│  • zip report folder         │  build          │  • list attachments of type                   │
│  • + .pbdd/manifest.json     │  attachment     │    "playwright-bdd-report" (REST, vso.build)  │
│  • ##vso[task.addattachment] │ ──────────────▶ │  • download + unzip in memory (JSZip)         │
└──────────────────────────────┘                 │  • ReportHost: archive path → blob: URL       │
                                                 │  • <iframe src=blob:…index.html>              │
                                                 │      └ shim rewrites relative URLs to blobs   │
                                                 │  • "View trace" → trace.playwright.dev        │
                                                 │      via postMessage (Blob, no download)      │
                                                 └───────────────────────────────────────────────┘
```

Report pages are served from `blob:` URLs, which can't act as a base for relative URLs. So a small shim ([src/viewer/shim.ts](src/viewer/shim.ts)) is injected at the top of every HTML page. It patches `fetch`, XHR, `URL`, `window.open`, the `src`/`href` setters, and adds a `MutationObserver`, so references like `data/abc.png` resolve to blob URLs served by [ReportHost](src/viewer/host.ts). The trace viewer bundled inside a report needs a service worker and can't run from a blob. Instead, trace links open trace.playwright.dev and the trace is handed over with its `postMessage` load API.

| Path | What |
| --- | --- |
| [tasks/PublishPlaywrightBddReport](tasks/PublishPlaywrightBddReport) | Pipeline task (`task.json`, `src/index.ts`) |
| [src/tab](src/tab) | Build results tab: SDK wiring, attachment source, styles |
| [src/viewer](src/viewer) | Archive loading, `ReportHost`, shim, and viewer UI (shared with the dev harness) |
| [src/shared/constants.ts](src/shared/constants.ts) | Attachment type and manifest format shared by the task and the tab |
| [src/dev](src/dev) | Local harness that runs the viewer without Azure DevOps |
| [samples/demo](samples/demo) | playwright-bdd sample project and an example `azure-pipelines.yml` |
| [vss-extension.json](vss-extension.json) | Extension manifest |

## Develop

```sh
npm install
(cd tasks/PublishPlaywrightBddReport && npm install)

# sample reports (the sample includes one deliberately failing scenario)
(cd samples/demo && npm install && npx playwright install chromium && npm test)

npm run fixtures   # runs the real task against the sample reports → .fixtures/*.zip
npm run dev        # http://localhost:5173/host.html  (viewer in a cross-origin sandboxed iframe)
                   # http://localhost:5173/dev.html   (viewer top-level, handy for devtools)
npm run typecheck
```

## Package and publish

1. Set `publisher` in [vss-extension.json](vss-extension.json) to your Marketplace publisher ID ([create one](https://marketplace.visualstudio.com/manage/createpublisher)).
2. `npm run package` builds `out/<publisher>.playwright-bdd-pane-<version>.vsix`.
   `npm run package:dev` builds a private `-dev` variant you can install side by side.
3. Upload the `.vsix` at <https://marketplace.visualstudio.com/manage>, share it with your organization, and install it there.
   Or use `npx tfx extension publish --vsix out/*.vsix --share-with <org> --token <PAT>`.

Every new upload needs a higher extension `version`. When the task changes, also bump `version` in [task.json](tasks/PublishPlaywrightBddReport/task.json), or agents will keep their cached copy.
