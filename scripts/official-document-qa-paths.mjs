import { accessSync, closeSync, constants, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

export const QA_OUTPUT_ROOT_ENV = "BOGUNON_OFFICIAL_DOCUMENT_QA_OUTPUT_ROOT";
export const QA_IDENTIFIER = "kr.sungandi.schoolhealthdesk.officialdocumentqa";

export function officialDocumentQaPaths(projectRoot = process.cwd(), env = process.env) {
  const project = resolve(projectRoot);
  const raw = env[QA_OUTPUT_ROOT_ENV];
  if (raw === undefined) {
    return { project, outputRoot: null, dist: join(project, "dist-official-document-qa"), target: join(project, "src-tauri/target-official-document-qa"), fixtures: join(project, "qa/official-document/fixtures") };
  }
  if (!raw.trim() || !isAbsolute(raw) || (process.platform === "win32" && parse(raw).root.length !== 3)) {
    throw new Error(`${QA_OUTPUT_ROOT_ENV} must be an absolute local drive path`);
  }
  const outputRoot = resolve(raw);
  const overlaps = (parent, child) => {
    const path = relative(parent, child);
    return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`));
  };
  if (outputRoot === parse(outputRoot).root || overlaps(project, outputRoot) || overlaps(outputRoot, project)) {
    throw new Error("QA output root must be dedicated and outside the source worktree, not a drive root");
  }
  return {
    project, outputRoot, dist: join(outputRoot, "dist-official-document-qa"), target: join(outputRoot, "target"),
    fixtures: join(outputRoot, "fixtures"), cache: join(outputRoot, "vite-cache"), temp: join(outputRoot, "temp"),
    logs: join(outputRoot, "logs"), moduleCache: join(outputRoot, "powershell/ModuleAnalysisCache"),
  };
}

function rejectLinks(path) {
  for (let current = path; ; current = dirname(current)) {
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`QA path must not use a symlink or junction: ${current}`);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    if (current === dirname(current)) break;
  }
}

function rejectNestedLinks(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`QA output contains a symlink or junction: ${path}`);
    if (entry.isDirectory()) rejectNestedLinks(path);
  }
}

export function prepareOfficialDocumentQaPaths(paths) {
  if (paths.outputRoot === null) return;
  try {
    rejectLinks(paths.outputRoot);
    accessSync(parse(paths.outputRoot).root, constants.R_OK | constants.W_OK);
    const marker = join(paths.outputRoot, ".official-document-qa-output.json");
    const owner = { version: 1, identifier: QA_IDENTIFIER, project: realpathSync(paths.project) };
    if (existsSync(paths.outputRoot)) {
      if (!lstatSync(paths.outputRoot).isDirectory()) throw new Error("QA output root is not a directory");
      if (readdirSync(paths.outputRoot).length > 0) {
        rejectLinks(marker);
        if (!existsSync(marker) || JSON.stringify(JSON.parse(readFileSync(marker, "utf8"))) !== JSON.stringify(owner)) {
          throw new Error("Existing output root is not owned by this official-document QA worktree; choose a new empty directory");
        }
      }
    }
    if (existsSync(paths.outputRoot)) rejectNestedLinks(paths.outputRoot);
    for (const path of [paths.dist, paths.target, paths.fixtures, paths.cache, paths.temp, paths.logs, dirname(paths.moduleCache)]) rejectLinks(path);
    mkdirSync(paths.outputRoot, { recursive: true });
    const probe = join(paths.outputRoot, `.write-probe-${randomUUID()}`);
    closeSync(openSync(probe, "wx"));
    unlinkSync(probe);
    if (!existsSync(marker)) writeFileSync(marker, `${JSON.stringify(owner)}\n`, { flag: "wx" });
    for (const path of [paths.cache, paths.temp, paths.logs, dirname(paths.moduleCache)]) mkdirSync(path, { recursive: true });
  } catch (error) {
    throw new Error(`Official-document QA output root unavailable or unsafe: ${paths.outputRoot}. Check drive connection, write permission and ownership. ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

export function officialDocumentQaEnvironment(paths, env = process.env) {
  return {
    ...env, CARGO_TARGET_DIR: paths.target,
    ...(paths.outputRoot === null ? {} : {
      [QA_OUTPUT_ROOT_ENV]: paths.outputRoot, TEMP: paths.temp, TMP: paths.temp,
      PSModuleAnalysisCachePath: paths.moduleCache,
    }),
  };
}

export function officialDocumentQaConfig(config, paths) {
  return paths.outputRoot === null ? config : {
    ...config, build: { ...config.build, frontendDist: paths.dist, beforeBuildCommand: null },
  };
}

export function requireFreshOfficialDocumentQaDist(paths) {
  if (paths.outputRoot !== null && existsSync(paths.dist) && readdirSync(paths.dist).length > 0) {
    throw new Error("External QA frontend output already exists; it will not be emptied. Choose a new QA output root");
  }
}
