export type WindowMaterial = Readonly<{
  windowMaterial: 'acrylic' | 'none';
  windowMaterialRequested: boolean;
  desktopAttachment: false;
}>;

type MaterialRequest = Readonly<{
  platform: string;
  release: string;
  requested: boolean;
  reducedTransparency: boolean;
  highContrast: boolean;
}>;

export function resolveWindowMaterial(request: MaterialRequest): WindowMaterial {
  // This selects a supported native material request; it does not attest compositor output.
  const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(request.release);
  const major = Number(version?.[1]);
  const build = Number(version?.[3]);
  const supported = request.platform === 'win32' && version !== null
    && major === 10 && version[2] === '0' && Number.isSafeInteger(build) && build >= 22621;
  return {
    windowMaterial: supported && request.requested && !request.reducedTransparency
      && !request.highContrast ? 'acrylic' : 'none',
    windowMaterialRequested: request.requested,
    desktopAttachment: false,
  };
}
