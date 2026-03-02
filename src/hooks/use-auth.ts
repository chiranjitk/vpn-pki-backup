'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AdminUser {
  id: string
  username: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER'
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED'
}

interface AuthState {
  user: AdminUser | null
  token: string | null
  isAuthenticated: boolean
  login: (user: AdminUser, token: string) => void
  logout: () => void
  updateUser: (user: Partial<AdminUser>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => {
        // Clear the persisted state
        if (typeof window !== 'undefined') {
          localStorage.removeItem('vpn-pki-auth')
          window.location.href = '/' // Redirect to home after logout
        }
        set({ user: null, token: null, isAuthenticated: false })
      },
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: 'vpn-pki-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export function useAuth() {
  const { user, token, isAuthenticated, login, logout, updateUser } = useAuthStore()
  return { user, token, isAuthenticated, login, logout, updateUser }
}

export function useHasPermission(requiredRole: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER') {
  const { user } = useAuth()
  const roleHierarchy = {
    SUPER_ADMIN: 4,
    ADMIN: 3,
    OPERATOR: 2,
    VIEWER: 1,
  }
  
  if (!user) return false
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}
