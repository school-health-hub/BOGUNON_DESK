import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const createUpdaterBuildEnvironment = (environment) => {
  const signingKey = environment.TAURI_SIGNING_PRIVATE_KEY?.trim()
    || environment.TAURI_SIGNING_PRIVATE_KEY_PATH?.trim();
  if (!signingKey) throw new Error("updater signing private key source가 설정되지 않았습니다.");
  const result = { ...environment, TAURI_SIGNING_PRIVATE_KEY: signingKey };
  delete result.TAURI_SIGNING_PRIVATE_KEY_PATH;
  return result;
};

export const runUpdaterBuild = (environment = process.env) => new Promise((resolveBuild, rejectBuild) => {
  const npmArguments = [
    "run", "tauri", "--", "build", "--target", "x86_64-pc-windows-msvc",
    "--bundles", "nsis", "--config", "src-tauri/tauri.release.conf.json",
  ];
  const isWindows = process.platform === "win32";
  const child = spawn(
    isWindows ? (environment.ComSpec || "cmd.exe") : "npm",
    isWindows ? ["/d", "/s", "/c", `npm.cmd ${npmArguments.join(" ")}`] : npmArguments,
    {
      cwd: projectRoot,
      env: createUpdaterBuildEnvironment(environment),
      stdio: "inherit",
    },
  );
  child.once("error", rejectBuild);
  child.once("exit", (code) => {
    if (code === 0) resolveBuild();
    else rejectBuild(new Error(`updater Tauri build가 종료 코드 ${code ?? "unknown"}로 실패했습니다.`));
  });
});

const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  runUpdaterBuild().catch((error) => {
    const message = error instanceof Error ? error.message : "updater Tauri build에 실패했습니다.";
    process.stderr.write(`[release:updater] ${message}\n`);
    process.exitCode = 1;
  });
}
