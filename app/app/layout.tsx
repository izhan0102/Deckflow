import DesktopOnMobile from "@/components/DesktopOnMobile";
import ForceDarkTheme from "@/components/ForceDarkTheme";

/**
 * Layout for everything under /app/*.
 *
 * Mounts DesktopOnMobile so the editor (and the My Decks list under it)
 * always renders in fixed-1280px desktop mode on phones. Other routes —
 * landing, /auth, /share, /about — are unaffected.
 *
 * Mounts ForceDarkTheme so the editor surfaces (prompt step, generate
 * overlay, slide-rail menus, panels) always render on a dark canvas.
 * They're designed for dark; the site-wide light theme is for the
 * marketing pages only. The user's saved preference is restored on exit.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DesktopOnMobile />
      <ForceDarkTheme />
      {children}
    </>
  );
}
