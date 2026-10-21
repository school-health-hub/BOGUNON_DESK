import base from "./dashboard-preview.config.mjs";
export default {
  ...base,
  cacheDir: ".omo/vite-preview-cache",
  build: { outDir: ".omo/preview-build", rollupOptions: { input: "qa/ui/dashboard-v2.html" } },
  plugins: [{ ...base.plugins[0], transform(code, id) {
    const result = base.plugins[0].transform(code, id);
    return typeof result === "string" ? result.replace('status: "ready"', 'status: new URLSearchParams(location.search).has("disconnected") ? "signedOut" : "ready"') : result;
  } }, ...base.plugins.slice(1), {
    name: "fixed-synthetic-clock",
    enforce: "pre",
    transform(_code, id) {
      if (id.replaceAll("\\", "/").endsWith("/dashboard/WidgetSessionContext.tsx")) return `
        export const useWidgetSession = () => ({ now: new Date(2026,9,21,9,41), memo: "합성 메모 · 검진 안내문 확인", setMemo: () => {} });`;
    },
  }],
};
