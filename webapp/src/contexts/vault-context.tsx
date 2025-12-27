'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { unlockVault } from '@/lib/crypto/client-crypto'
import type { KdfParams } from '@/lib/crypto/vault-crypto'

interface VaultMetadata {
  vaultId: string
  kdfSalt: string
  kdfParams: KdfParams
}

interface VaultContextType {
  kek: Uint8Array | null
  vaultMetadata: VaultMetadata | null
  isUnlocked: () => boolean
  unlock: (password: string, metadata: VaultMetadata) => Promise<void>
  lock: () => void
}

const VaultContext = createContext<VaultContextType | undefined>(undefined)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [kek, setKek] = useState<Uint8Array | null>(null)
  const [vaultMetadata, setVaultMetadata] = useState<VaultMetadata | null>(null)

  const lock = () => {
    setKek(null)
    setVaultMetadata(null)
    // Clear any references to help GC
  }

  // Listen to auth state changes and lock vault on sign-out
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setKek(null)
        setVaultMetadata(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const isUnlocked = () => kek !== null

  const unlock = async (password: string, metadata: VaultMetadata) => {
    try {
      const derivedKek = await unlockVault(password, metadata.kdfSalt, metadata.kdfParams)
      setKek(derivedKek)
      setVaultMetadata(metadata)
      // Clear password from memory (it's a parameter, but we can't do much about that)
      // The password should be cleared by the caller
    } catch (error) {
      throw error
    }
  }

  return (
    <VaultContext.Provider value={{ kek, vaultMetadata, isUnlocked, unlock, lock }}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVault() {
  const context = useContext(VaultContext)
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider')
  }
  return context
}

