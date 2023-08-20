/**
 * Parses the env.UPSTREAMS variable and returns a set of URLs
 * @returns set of upstream URLs or throws if env.UPSTREAMS is not defined or invalid
 */
export function parseUpstreams(UPSTREAMS?: string): Set<URL> | never {
  if (!UPSTREAMS) {
    throw new Error("env.UPSTREAMS is missing");
  }
  const upstreams = UPSTREAMS.split(",");
  const urls = new Set<URL>();
  for (const upstream of upstreams) {
    try {
      const upstreamUrl = new URL(upstream);
      urls.add(upstreamUrl);
    } catch (error) {
      // URL constructor throws if the URL is invalid
      // https://developer.mozilla.org/en-US/docs/Web/API/URL/URL
      throw new Error(`${upstream} is not a valid URL`, { cause: error });
    }
  }
  return urls;
}
