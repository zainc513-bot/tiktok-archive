export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const target = reqUrl.searchParams.get('url');

  const json = (obj, status = 200, extra = {}) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json', ...extra }
    });

  if (!target) {
    return json({ error: 'missing url param' }, 400);
  }

  // TikTok only needs the numeric video ID; the username can be a placeholder.
  const m = target.match(/video\/(\d+)/);
  const normalized = m ? 'https://www.tiktok.com/@_/video/' + m[1] : target;

  try {
    const upstream = await fetch(
      'https://www.tiktok.com/oembed?url=' + encodeURIComponent(normalized),
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );

    if (!upstream.ok) {
      // A real 404 means the video is deleted/private, so the app can
      // mark it "unavailable" instead of retrying.
      const status = upstream.status === 404 ? 404 : 502;
      return json({ error: 'upstream error', status: upstream.status }, status);
    }

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return json({ error: 'upstream returned non-JSON', preview: text.slice(0, 120) }, 502);
    }

    return json(data, 200, { 'Cache-Control': 'public, max-age=86400' });
  } catch (err) {
    return json({ error: 'fetch failed', message: String(err) }, 500);
  }
}
