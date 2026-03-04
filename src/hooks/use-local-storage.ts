'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook for reading from localStorage with SSR safety
 * Returns the stored value and a setter function
 * During SSR, returns the initial value
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key)
      if (item !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- This is a valid pattern for hydrating from localStorage after SSR
        setStoredValue(JSON.parse(item))
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
    }
    setHydrated(true)
  }, [key])

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value
      // Save state
      setStoredValue(valueToStore)
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  return [storedValue, setValue, hydrated]
}

/**
 * Custom hook for SSR-safe hydration detection
 * Returns true once the component has hydrated on the client
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This is a valid pattern for tracking hydration state after SSR
    setHydrated(true)
  }, [])

  return hydrated
}
