import type { User } from '@supabase/supabase-js'

export interface DemoStatus {
  isDemo: boolean
  isReale: boolean
  isScaduto: boolean
  giorniRimasti: number
  dataScadenza: Date | null
  isRighetti: boolean
}

export function getDemoStatus(user: User | null | undefined): DemoStatus {
  if (!user) {
    return { isDemo: false, isReale: false, isScaduto: false, giorniRimasti: 0, dataScadenza: null, isRighetti: false }
  }

  const isRighetti = user.email?.toLowerCase().trim() === 'righetti@righetti.club'
  if (isRighetti) {
    return { isDemo: false, isReale: true, isScaduto: false, giorniRimasti: 999, dataScadenza: null, isRighetti: true }
  }

  const ruolo = String(user.user_metadata?.ruolo || user.app_metadata?.ruolo || '').toLowerCase().trim()
  if (ruolo === 'reale' || ruolo === 'admin') {
    return { isDemo: false, isReale: true, isScaduto: false, giorniRimasti: 999, dataScadenza: null, isRighetti: false }
  }

  let scadenza: Date
  if (user.user_metadata?.demo_scadenza) {
    scadenza = new Date(user.user_metadata.demo_scadenza)
  } else if (user.created_at) {
    scadenza = new Date(new Date(user.created_at).getTime() + 15 * 24 * 60 * 60 * 1000)
  } else {
    scadenza = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  }

  const diffMs = scadenza.getTime() - Date.now()
  const giorniRimasti = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  const isScaduto = diffMs <= 0

  return { isDemo: true, isReale: false, isScaduto, giorniRimasti, dataScadenza: scadenza, isRighetti: false }
}
