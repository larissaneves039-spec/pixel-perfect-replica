// Auth email callbacks must keep the deployment subdirectory on GitHub Pages.
export function authEmailRedirect(origin: string, baseUrl: string): string {
  const basePath = `/${baseUrl.split("/").filter(Boolean).join("/")}`;
  return new URL(basePath === "/" ? "/" : `${basePath}/`, origin).href;
}