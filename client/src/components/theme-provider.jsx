import { createContext, useContext, useEffect, useState } from "react"

const initialState = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => null,
}

const ThemeProviderContext = createContext(initialState)

const readStored = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches

/** Telefon status paneli rangi mavzuga mos bo'lsin (PWA'da ayniqsa ko'rinadi) */
const THEME_COLORS = { light: "#f9f8fc", dark: "#15131d" }

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}) {
  const [theme, setThemeState] = useState(() => readStored(storageKey, defaultTheme))
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Tizim mavzusi ilova ochiq turganda o'zgarsa ham kuzatamiz
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    root.style.colorScheme = resolvedTheme

    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", THEME_COLORS[resolvedTheme]))
  }, [resolvedTheme])

  const value = {
    theme,
    resolvedTheme,
    setTheme: (next) => {
      try {
        localStorage.setItem(storageKey, next)
      } catch {
        // shaxsiy rejim — mavzu faqat shu sessiyada saqlanadi
      }
      setThemeState(next)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
