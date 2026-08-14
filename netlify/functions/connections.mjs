import { getStore } from '@netlify/blobs';
import { getConfigurationStatus, getSlotConfig, slots } from '../lib/oauth.mjs';

const store = () => getStore({ name: 'social-connections', consistency: 'strong' });

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default async (req) => {
  if (req.method === 'DELETE') {
    const body = await req.json().catch(() => ({}));
    if (!slots.includes(body.slot)) return json({ error: 'Unknown account slot' }, 400);
    await store().delete(body.slot);
    return json({ ok: true, slot: body.slot });
  }

  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const connections = await Promise.all(slots.map(async (slot) => {
    const config = getSlotConfig(slot);
    const configuration = getConfigurationStatus(slot);
    const saved = await store().get(slot, { type: 'json', consistency: 'strong' }).catch(() => null);
    return {
      slot,
      provider: config.provider,
      label: config.label,
      requiredScopes: config.scopes,
      configured: configuration.configured,
      missingEnvironment: configuration.missing,
      connected: Boolean(saved?.connected && saved?.public),
      account: saved?.public || null,
      connectedAt: saved?.connectedAt || null,
      lastError: saved?.lastError || null,
    };
  }));

  return json({ connections });
};
