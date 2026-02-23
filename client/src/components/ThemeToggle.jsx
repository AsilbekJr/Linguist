import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const isDark = theme === "dark" || 
    (theme === "system" && typeof window !== 'undefined' && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-full w-10 h-10 border-border bg-card hover:bg-accent hover:text-accent-foreground flex items-center justify-center transition-all shadow-sm relative z-50 pointer-events-auto cursor-pointer"
      title={isDark ? "Yorug' rejimga o'tish" : "Qorong'u rejimga o'tish"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-500 transition-colors" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700 transition-colors" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
