const allowedHosts = new Set(["shama.dxrating.net", "maimaidx-eng.com"]);

export async function GET(request: Request) {
  const input = new URL(request.url).searchParams.get("url");
  if (!input) return new Response("Missing URL", { status: 400 });

  let target: URL;
  try {
    target = new URL(input);
  } catch {
    return new Response("Invalid URL", { status: 400 });
  }

  if (target.protocol !== "https:" || !allowedHosts.has(target.hostname)) {
    return new Response("Asset host is not allowed", { status: 403 });
  }

  const response = await fetch(target, { redirect: "follow" });
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
