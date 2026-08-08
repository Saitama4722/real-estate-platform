/**
 * Pass-through.
 *
 * The slate band + wide Container that used to live here moved down into
 * `(cabinet)/layout.tsx`: this layout also wraps `/account/login`, which is a
 * full-bleed split screen and must not inherit the cabinet's page chrome.
 * Anything genuinely common to BOTH the cabinet and login would go here — at
 * present there is nothing.
 */
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
