export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(mb >= 1 ? 1 : 2)} MB`
}

export function makeFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}


