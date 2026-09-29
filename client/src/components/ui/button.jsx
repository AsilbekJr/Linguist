import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

/**
 * Tugmalar. Bosilganda biroz kichrayadi (`active:scale`) — telefonda
 * "bosildi" hissi aynan shundan keladi.
 * Minimal balandlik 44px (`default`) — Apple/Google tavsiya qilgan teginish nishoni.
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-[background-color,box-shadow,transform,color,border-color,opacity] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.1),0_6px_16px_-6px_color-mix(in_oklch,var(--primary)_70%,transparent)] hover:brightness-110",
        brand:
          "brand-gradient text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_8px_24px_-8px_color-mix(in_oklch,var(--primary)_80%,transparent)] hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110",
        success:
          "bg-success text-success-foreground shadow-sm hover:brightness-110",
        outline:
          "border border-border bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        soft:
          "bg-primary/10 text-primary hover:bg-primary/15",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-lg px-3.5 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
        xl: "h-14 rounded-2xl px-8 text-base",
        icon: "size-11",
        "icon-sm": "size-9 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />
  );
})
Button.displayName = "Button"

// shadcn andozasi: variantlar Link kabi boshqa elementlarga ham qo'llanishi uchun eksport qilinadi
// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }
