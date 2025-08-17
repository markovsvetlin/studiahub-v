// Deprecated: replaced by shadcn's cn in src/lib/utils
export function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ')
}
