import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

const EditContext = createContext(null)

export function EditProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function cargarSesion() {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    setSession(currentSession)
    setLoading(false)
  }

  async function activarEdicion(pin) {
    if (!/^\d{5}$/.test(pin)) {
      return { error: { message: 'El código debe tener exactamente 5 números.' } }
    }

    const editorEmail = import.meta.env.VITE_EDITOR_EMAIL

    if (!editorEmail) {
      return {
        error: {
          message: 'Falta configurar VITE_EDITOR_EMAIL en el archivo .env.local.',
        },
      }
    }

    // Acceso interno FUL-MAR: el PIN se utiliza directamente con la
    // cuenta técnica de Supabase. No requiere SQL ni Edge Functions.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: editorEmail,
      password: `fm-${pin}`,
    })

    if (error) {
      return {
        error: {
          message: error.message === 'Invalid login credentials'
            ? 'Código incorrecto.'
            : error.message,
        },
      }
    }

    return { data, error: null }
  }

  async function desactivarEdicion() {
    await supabase.auth.signOut()
  }

  const editing = Boolean(session?.user)

  return (
    <EditContext.Provider value={{ session, editing, loading, activarEdicion, desactivarEdicion }}>
      {children}
    </EditContext.Provider>
  )
}

export function useEdit() {
  return useContext(EditContext)
}
