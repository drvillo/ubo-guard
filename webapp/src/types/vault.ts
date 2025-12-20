export interface VaultInitParams {
  kdfSalt: string // Base64
  kdfParams: {
    memory: number
    time: number
    parallelism: number
  }
}

export interface VaultStatus {
  id: string
  createdAt: Date
  updatedAt: Date
}

