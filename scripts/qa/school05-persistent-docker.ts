/** Windows QA only: persistent psql sessions inside the isolated Docker container. Never packaged. */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const container = "bogunon-school05-pg";
const dockerHost = "npipe:////./pipe/docker_engine";

class PersistentPsql {
  #child: ChildProcessWithoutNullStreams | undefined;
  #sequence = 0;
  #tail = Promise.resolve();

  constructor(readonly user: "postgres" | "school_client") {}

  query(query: string, signal?: AbortSignal): Promise<string> {
    const run = this.#tail.then(() => this.#run(query, signal));
    this.#tail = run.then(() => undefined, () => undefined);
    return run;
  }

  #run(query: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.#child ?? this.#start();
      const marker = `__BOGUNON_QUERY_${++this.#sequence}__`;
      let output = "";
      let errors = "";
      const timer = setTimeout(() => child.kill(), 15_000);
      const abort = () => child.kill();
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        child.stdout.off("data", stdout);
        child.stderr.off("data", stderr);
        child.off("close", closed);
      };
      const stderr = (bytes: Buffer) => { errors += bytes.toString(); };
      const stdout = (bytes: Buffer) => {
        output += bytes.toString();
        const end = output.indexOf(`${marker} `);
        if (end < 0) return;
        const lineEnd = output.indexOf("\n", end);
        if (lineEnd < 0) return;
        cleanup();
        const status = output.slice(end + marker.length + 1, lineEnd).trim();
        const result = output.slice(0, end).trim();
        if (status === "00000") resolve(result);
        else {
          if (this.#child === child) this.#child = undefined;
          child.kill();
          reject(new Error(errors.trim() || `local_psql_${status}`));
        }
      };
      const closed = () => {
        cleanup();
        reject(new Error(errors.trim() || "local_psql_closed"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", stdout);
      child.stderr.on("data", stderr);
      child.once("close", closed);
      child.stdin.write(`${query};\n\\echo ${marker} :LAST_ERROR_SQLSTATE\n`, error => {
        if (error) closed();
      });
    });
  }

  #start(): ChildProcessWithoutNullStreams {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("DOCKER_")));
    const child = spawn("docker", ["--host", dockerHost, "exec", "-i", container, "psql", "-X", "-qAt", "-U", this.user, "-d", "school01a"], {
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#child = child;
    child.stdin.on("error", () => child.kill());
    child.once("close", () => { if (this.#child === child) this.#child = undefined; });
    return child;
  }
}

const sessions = new Map<"postgres" | "school_client", PersistentPsql>();

export async function sql(query: string, user = "postgres", signal?: AbortSignal): Promise<string> {
  if (process.platform !== "win32" || process.env.SCHOOL05_PERSISTENT_DOCKER !== "1" || (user !== "postgres" && user !== "school_client")) {
    throw new Error("Persistent Docker QA configuration rejected");
  }
  let session = sessions.get(user);
  if (!session) {
    session = new PersistentPsql(user);
    sessions.set(user, session);
  }
  return session.query(query, signal);
}
