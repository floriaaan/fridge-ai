export interface ProjectInfo {
  repository: string
  url: string
  stars: number
  /** SPDX id, e.g. `MIT`. */
  license: string | null
  /** Latest published release tag; `null` when none has been cut yet. */
  latestVersion: string | null
}
