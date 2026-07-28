// Mirrors the extension's host_permissions in public/manifest.json: these are
// the only paths the extension can produce asset URLs for.
const allowedPrefixes: ReadonlyArray<readonly [string, string]> = [
  ["shama.dxrating.net", "/images/cover/v2/"],
  ["maimaidx-eng.com", "/maimai-mobile/"],
  ["maimaidx.jp", "/maimai-mobile/"]
];

const isAllowed = (target: URL) => allowedPrefixes.some(
  ([hostname, prefix]) => target.hostname === hostname && target.pathname.startsWith(prefix)
);

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("url");
  if (!input) return new Response("Missing URL", { status: 400 });

  let target: URL;
  try {
    target = new URL(input);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (target.protocol !== "https:" || !isAllowed(target)) {
    return new Response("Asset host is not allowed", { status: 403 });
  }

  // Refuse redirects rather than following them: fetch() does not re-check the
  // allowlist against a redirect target, so an open redirect on an allowed host
  // would otherwise let this proxy reach an arbitrary address.
  const response = await fetch(target, { redirect: "manual" });
  if (response.status === 0 || (response.status >= 300 && response.status < 400)) {
    return new Response("Asset redirect is not allowed", { status: 502 });
  }
  if (!response.ok || !response.body) {
    return new Response("Asset unavailable", { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "public, max-age=86400"
    }
  });
}
