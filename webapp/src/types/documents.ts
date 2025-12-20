export type DocumentType = 'ID' | 'ProofOfAddress' | 'SourceOfWealth'

export interface DocumentMetadata {
  id: string
  docType: DocumentType
  filename: string
  size: number
  uploadedAt: Date
  lastUpdatedBy: string
}

export interface DocumentDownloadInfo {
  storagePath: string
  encryptedDekForOwner: string // Base64
  dekNonce: string // Base64
  ciphertextChecksum: string
}

