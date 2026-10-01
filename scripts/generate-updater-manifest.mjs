const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

const parseHttpsUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("installer URL이 유효하지 않습니다.");
  }
  if (url.protocol !== "https:") throw new Error("installer URL은 HTTPS여야 합니다.");
  return url.href;
};

const parsePublishedAt = (value) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("publishedAt은 UTC RFC3339 형식이어야 합니다.");
  }
  return value;
};

export const generateUpdaterDocuments = ({
  version,
  publishedAt,
  notes,
  installerUrl,
  signature,
  sha256,
  bytes,
}) => {
  if (!semverPattern.test(version)) throw new Error("release version이 유효한 SemVer가 아닙니다.");
  const parsedPublishedAt = parsePublishedAt(publishedAt);
  const parsedInstallerUrl = parseHttpsUrl(installerUrl);
  const parsedSignature = signature.trim();
  if (parsedSignature === "") throw new Error("updater signature가 비어 있습니다.");
  if (!Array.isArray(notes) || notes.length === 0 || notes.some((note) => typeof note !== "string" || note.trim() === "")) {
    throw new Error("release notes가 비어 있습니다.");
  }
  if (!/^[a-f0-9]{64}$/u.test(sha256)) throw new Error("installer SHA256이 유효하지 않습니다.");
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error("installer byte 크기가 유효하지 않습니다.");

  return {
    latest: {
      version,
      notes: notes.join("\n"),
      pub_date: parsedPublishedAt,
      platforms: {
        "windows-x86_64": {
          url: parsedInstallerUrl,
          signature: parsedSignature,
        },
      },
    },
    metadata: {
      version,
      publishedAt: parsedPublishedAt,
      notes: [...notes],
      installerUrl: parsedInstallerUrl,
      sha256,
      bytes,
    },
  };
};
