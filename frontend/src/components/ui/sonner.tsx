"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      closeButton
      expand={true}
      visibleToasts={5}
      duration={4000}
      gap={12}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--card)",
          "--success-text": "rgb(34, 197, 94)",
          "--success-border": "rgba(34, 197, 94, 0.3)",
          "--error-bg": "var(--card)",
          "--error-text": "rgb(239, 68, 68)",
          "--error-border": "rgba(239, 68, 68, 0.3)",
          "--warning-bg": "var(--card)",
          "--warning-text": "rgb(245, 158, 11)",
          "--warning-border": "rgba(245, 158, 11, 0.3)",
          "--info-bg": "var(--card)",
          "--info-text": "rgb(59, 130, 246)",
          "--info-border": "rgba(59, 130, 246, 0.3)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
