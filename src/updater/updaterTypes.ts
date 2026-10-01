export type UpdateMetadata = {
  readonly currentVersion: string;
  readonly version: string;
  readonly publishedAt: string | null;
  readonly notes: string | null;
};

export type NativeUpdate = {
  readonly currentVersion: string;
  readonly version: string;
  readonly date?: string;
  readonly body?: string;
  readonly downloadAndInstall: (onEvent?: (event: NativeDownloadEvent) => void) => Promise<void>;
  readonly close: () => Promise<void>;
};

export type NativeDownloadEvent =
  | { readonly event: "Started"; readonly data: { readonly contentLength?: number } }
  | { readonly event: "Progress"; readonly data: { readonly chunkLength: number } }
  | { readonly event: "Finished" };

export type UpdateInstallProgress = {
  readonly phase: "downloading" | "installing";
  readonly downloadedBytes: number;
  readonly totalBytes: number | null;
};

export type UpdateInstallResult =
  | { readonly status: "completed" }
  | { readonly status: "error"; readonly kind: "integrity" | "general"; readonly message: string };

export type NativeUpdaterAdapter = {
  readonly isAvailable: () => boolean;
  readonly check: () => Promise<NativeUpdate | null>;
};

export type UpdateCheckResult =
  | { readonly status: "unavailable" }
  | { readonly status: "upToDate" }
  | {
    readonly status: "available";
    readonly metadata: UpdateMetadata;
    readonly install: (
      onProgress: (progress: UpdateInstallProgress) => void,
    ) => Promise<UpdateInstallResult>;
    readonly release: () => Promise<void>;
  }
  | { readonly status: "error"; readonly message: string };

export type UpdaterService = {
  readonly check: () => Promise<UpdateCheckResult>;
};

export type DesktopUpdaterState =
  | { readonly status: "idle"; readonly lastCheckedAt: number | null }
  | { readonly status: "checking"; readonly source: "startup" | "manual"; readonly lastCheckedAt: number | null }
  | { readonly status: "upToDate"; readonly lastCheckedAt: number }
  | { readonly status: "unavailable"; readonly lastCheckedAt: number | null }
  | { readonly status: "available"; readonly metadata: UpdateMetadata; readonly lastCheckedAt: number }
  | { readonly status: "confirming"; readonly metadata: UpdateMetadata; readonly lastCheckedAt: number }
  | { readonly status: "downloading"; readonly metadata: UpdateMetadata; readonly progress: UpdateInstallProgress; readonly lastCheckedAt: number }
  | { readonly status: "installing"; readonly metadata: UpdateMetadata; readonly lastCheckedAt: number }
  | {
    readonly status: "error";
    readonly operation: "check" | "install";
    readonly message: string;
    readonly lastCheckedAt: number | null;
  };
