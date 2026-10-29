import { rolldown } from "rolldown";
import { expect, it } from "vitest";

it("keeps web search callable when the Finder imports it before the plan service", async () => {
  // Given the Finder's import order in a production browser bundle.
  const source = (name: string): string => JSON.stringify(decodeURIComponent(new URL(name, import.meta.url).pathname).replace(/^\/(?=[a-z]:\/)/i, ""));
  const entry = "finder-search-regression";
  const bundle = await rolldown({
    input: entry,
    logLevel: "silent",
    plugins: [{
      name: entry,
      resolveId: id => id === entry || id.endsWith("/" + entry) ? String.fromCharCode(0) + entry : null,
      load: id => id === String.fromCharCode(0) + entry ? `
        import { supportedWebSearchModel } from ${source("./webSearch.ts")};
        import { chatGptPlanService } from ${source("./chatgptPlanService.ts")};
        globalThis.finderSearchReady = supportedWebSearchModel("gpt-6.1-sol")
          && typeof chatGptPlanService.searchWeb === "function";
      ` : null,
    }],

  });
  const result = await bundle.generate({ format: "iife", minify: true });
  await bundle.close();
  const output = result.output.find(item => item.type === "chunk");
  if (output === undefined) throw new Error("Browser bundle has no entry chunk");
  // When the browser evaluates the bundle, without any network calls.
  const ready: unknown = new Function("globalThis", output.code + "; return globalThis.finderSearchReady;")({});
  // Then the real default service exposes the search operation.
  expect(ready).toBe(true);
});
