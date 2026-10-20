import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(import.meta.dirname, "..", ".github", "workflows", "my-finance-check.yml");
const readWorkflow = () => readFile(workflowPath, "utf8");

describe("MY FINANCE verification workflow", () => {
  it("reuses one Windows target across tests, check, and the integrated build", async () => {
    const source = await readWorkflow();

    expect(source).toContain(
      "cargo test --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc my_finance",
    );
    expect(source).toContain(
      "cargo check --locked --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc",
    );
    expect(source).toContain(
      "npm run tauri build -- --target x86_64-pc-windows-msvc --no-bundle",
    );
  });

  it("keeps the verification and security checks intact", async () => {
    const source = await readWorkflow();

    expect(source).toContain("npm test -- --maxWorkers=4");
    expect(source).toContain("npx tsc --noEmit");
    expect(source).toContain("npm run build");
    expect(source).toContain("Verify vendored OpenSSL build prerequisites");
    expect(source).toContain("Verify app has no external OpenSSL DLL dependency");
    expect(source).toContain("timeout-minutes: 45");
  });
});
