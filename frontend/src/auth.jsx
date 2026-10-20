import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'
const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api('/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])
  const login = async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', form: { username: email, password } })
    setToken(r.access_token)
    const me = await api('/auth/me')
    setUser(me)
    return me
  }
  const logout = () => { setToken(null); setUser(null) }
  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>
}
