export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const target = reqUrl.searchParams.get('url');

  if (!target) {
    return new Response(JSON.stringify({ error: 'missing url param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // TikTok data exports often use tiktokv.com share links (mobile deep-link format),
  // which the oEmbed service doesn't handle well. TikTok only actually needs the
  // numeric video ID; the username segment can be a placeholder.
  function normalizeForOembed(link) {
    const m = link.match(/video\/(\d+)/);
    if (m) return 'https://www.tiktok.com/@_/video/' + m[1];
    return link;
  }

  const normalized = normalizeForOembed(target);

  try {
    const upstream = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(normalized), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TikTokArchiveTool/1.0)' }
    });

    if (!upstream.ok) {
      // Pass through a real 404 so the client knows the video is actually
      // gone (deleted/private) rather than treating it like a transient
      // proxy hiccup worth retrying.
      const status = upstream.status === 404 ? 404 : 502;
      return new Response(JSON.stringify({ error: 'upstream error', status: upstream.status }), {
        status: status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'fetch failed', message: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

