import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 })

  const loadMe = useCallback(async () => {
    if (!getToken()) { setUser(null); return null }
    try { const me = await api('/auth/me'); setUser(me); return me }
    catch { setToken(null); setUser(null); return null }
  }, [])

  const refreshCounts = useCallback(async () => {
    if (!getToken()) return
    try { setCounts(await api('/notifications/counts')) } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadMe().finally(() => setReady(true)) }, [loadMe])
  useEffect(() => {                       // badge numbers in the navbar
    if (!user) { setCounts({ notifications: 0, messages: 0 }); return }
    refreshCounts()
    const t = setInterval(refreshCounts, 60000)
    return () => clearInterval(t)
  }, [user, refreshCounts])

  const login = async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', form: { username: email, password } })
    setToken(r.access_token)
    return loadMe()
  }
  const loginWithToken = async (token) => { setToken(token); return loadMe() }
  const logout = () => { setToken(null); setUser(null) }

  return <Ctx.Provider value={{ user, ready, login, loginWithToken, logout, refresh: loadMe, counts, refreshCounts }}>{children}</Ctx.Provider>
}
