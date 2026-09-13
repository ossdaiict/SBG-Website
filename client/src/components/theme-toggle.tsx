import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface ThemeToggleProps {
  className?: string
  iconClassName?: string
}

export function ThemeToggle({ className, iconClassName }: ThemeToggleProps = {}) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const defaultButtonClass =
    "h-9 w-9 rounded-lg text-textMuted hover:text-textMuted cursor-pointer bg-card/80 backdrop-blur border border-borderSoft/60 hover:bg-hoverSoft shadow-sm transition-all flex items-center justify-center shrink-0"
  const defaultIconClass = "h-4 w-4 shrink-0"

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        className={cn(defaultButtonClass, className)}
      >
        <Sun className={cn(defaultIconClass, iconClassName)} />
      </Button>
    )
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          className={cn(defaultButtonClass, className)}
        >
          {resolvedTheme === "dark" ? (
            <Moon className={cn(defaultIconClass, iconClassName)} />
          ) : (
            <Sun className={cn(defaultIconClass, iconClassName)} />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-borderSoft bg-card">
        <DropdownMenuLabel className="text-textPrimary">Theme</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-borderSoft" />
        <DropdownMenuItem
          onClick={() => setTheme("light")}
          className="cursor-pointer rounded-lg focus:bg-hoverSoft"
        >
          <Sun className="mr-2 h-4 w-4" />
          Light
          {theme === "light" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("dark")}
          className="cursor-pointer rounded-lg focus:bg-hoverSoft"
        >
          <Moon className="mr-2 h-4 w-4" />
          Dark
          {theme === "dark" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme("system")}
          className="cursor-pointer rounded-lg focus:bg-hoverSoft"
        >
          <Monitor className="mr-2 h-4 w-4" />
          System
          {theme === "system" && <Check className="ml-auto h-4 w-4" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
