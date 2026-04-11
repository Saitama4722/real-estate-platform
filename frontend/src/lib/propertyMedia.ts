/** True when the string should be rendered as an image src (not a text placeholder). */
export function isPropertyImageUrl(value: string): boolean {
  const v = value.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return true;
  if (v.startsWith("/")) return true;
  return false;
}
