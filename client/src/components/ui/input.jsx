import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Matn maydoni. Telefonda shrift 16px — undan kichik bo'lsa iOS Safari
 * fokusda sahifani avtomatik kattalashtirib yuboradi.
 */
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/80 hover:border-muted-foreground/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15 file:border-0 file:bg-transparent file:text-sm file:font-medium sm:text-[15px]",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-24 w-full resize-none rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground shadow-xs transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/80 hover:border-muted-foreground/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[15px]",
      className
    )}
    ref={ref}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Input, Textarea }
