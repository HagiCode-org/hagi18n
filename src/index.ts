import { packageName, packageVersion } from "./version.js";

export {
  getPackageMetadata,
  packageName,
  packageVersion,
  type PackageMetadata
} from "./version.js";

export interface Hagi18nRuntimeInfo {
  packageName: string;
  version: string;
  status: "foundation";
}

export function createRuntimeInfo(): Hagi18nRuntimeInfo {
  return {
    packageName,
    version: packageVersion,
    status: "foundation"
  };
}
