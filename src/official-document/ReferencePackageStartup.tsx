import { useEffect } from "react";
import { defaultReferencePackageService, ReferencePackageRestoreError } from "./referencePackageService";
import { ReferencePackageStorageError } from "./referencePackageStorage";

type Props = { readonly initialize?: () => Promise<void> };

export function ReferencePackageStartup({ initialize = defaultReferencePackageService.initialize }: Props) {
  useEffect(() => {
    void initialize().catch((error: unknown) => {
      if (error instanceof ReferencePackageRestoreError || error instanceof ReferencePackageStorageError) return;
      throw error;
    });
  }, [initialize]);
  return null;
}
