// images uploaded in the admin console, kept in HUB_KV
export async function onRequestGet({ env, params }) {
  if (!/^[0-9a-f]{24}$/.test(params.id)) return new Response('Not found', { status: 404 });
  const { value, metadata } = await env.HUB_KV.getWithMetadata('media:' + params.id, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });
  return new Response(value, { headers: { 'content-type': (metadata && metadata.type) || 'application/octet-stream',
    'cache-control': 'private, max-age=86400' } });
}
