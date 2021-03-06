/**
 * This is a direct representation of what we get back from the `/repositories`
 * API call.
 */
export interface DockerHubAPIRepo {
  readonly can_edit: boolean
  readonly description: string
  readonly is_automated: boolean
  readonly is_migrated: boolean
  readonly is_private: boolean
  readonly last_updated: string
  readonly name: string
  readonly namespace: string
  readonly pull_count: number
  readonly repository_type: string
  readonly star_count: number
  readonly status: number
  readonly user: string
}

/**
 * Union type representing the architecture defined in part of an OCI image's
 * manifest list.
 *
 * As specified in the Docker Manifest spec, any valid GOARCH values are valid
 * image architecture values, and vice versa:
 * > The platform object describes the platform which the image in the manifest
 * > runs on. A full list of valid operating system and architecture values are
 * > listed in the Go language documentation for $GOOS and $GOARCH
 * @see https://docs.docker.com/registry/spec/manifest-v2-2/#manifest-list-field-descriptions
 */
export enum Architecture {
  i386 = '386',
  amd64 = 'amd64',
  arm = 'arm',
  arm64 = 'arm64',
  mips = 'mips',
  mips64 = 'mips64',
  mips64le = 'mips64le',
  mipsle = 'mipsle',
  ppc64 = 'ppc64',
  ppc64le = 'ppc64le',
  s390x = 's390x',
  wasm = 'wasm',
}

/**
 * Union type representing the OS defined in part of an OCI image's
 * manifest list.
 * See the docs for the `Architecture` type above for more info.
 */
export enum OS {
  aix = 'aix',
  android = 'android',
  darwin = 'darwin',
  dragonfly = 'dragonfly',
  freebsd = 'freebsd',
  illumos = 'illumos',
  js = 'js',
  linux = 'linux',
  netbsd = 'netbsd',
  openbsd = 'openbsd',
  plan9 = 'plan9',
  solaris = 'solaris',
  windows = 'windows',
}

export enum ManifestMediaType {
  Manifest = 'application/vnd.docker.distribution.manifest.v2+json',
  ManifestList = 'application/vnd.docker.distribution.manifest.list.v2+json',
}

/**
 * Yes, there's *way* more information contained in the manifest / "fat"
 * manifestList than just architectures, but I find this to be the most
 * relevant section for my projects. PR's welcome.
 */
export interface DockerManifest {
  readonly digest: string
  readonly mediaType: ManifestMediaType
  readonly platform: Array<{
    architecture: Architecture
    os: OS
  }>
  readonly schemaVersion: 1 | 2 | number
}

export interface DockerManifestList {
  readonly manifests: DockerManifest[]
  readonly mediaType: ManifestMediaType
  readonly schemaVersion: 1 | 2 | any
}

export interface DockerHubRepo {
  // ========================
  // Main fields of interest
  // ========================
  readonly description: string | null | undefined
  readonly lastUpdated: string
  readonly name: string
  readonly pullCount: number
  readonly starCount: number
  readonly user: string

  // Manifest type *may* be nested within this interface, but is usually
  // fetched and returned separately.
  readonly manifestList?: DockerManifestList
  readonly tags?: Tag[]

  // =============================================
  // Other stuff that comes down through the API,
  // that some may find useful
  // =============================================
  readonly canEdit?: boolean
  readonly isAutomated?: boolean
  readonly isMigrated?: boolean
  readonly isPrivate?: boolean
  readonly namespace?: string
  readonly repositoryType?: string
  readonly status?: number
}

export interface Tag {
  creator: number
  fullSize: number
  id: number
  images: TagElement[]
  lastUpdated: string
  lastUpdater: number
  lastUpdaterUsername: string
  name: string
  repository: number
  v2: boolean
}

export interface TagElement {
  architecture: Architecture
  digest: string
  features: string
  os: OS
  size: number
}
