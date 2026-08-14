import {
  buildAuthorizationUrl,
  createOAuthState,
  getConfigurationStatus,
  getSlotConfig,
} from '../lib/oauth.mjs';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(req.url);
  const slot = url.searchParams.get('slot');
  const config = getSlotConfig(slot);
  if (!config) return json({ error: 'Unknown account slot' }, 400);

  const configuration = getConfigurationStatus(slot);
  if (!configuration.configured) {
    return json({
      error: 'This provider is not configured yet.',
      slot,
      missingEnvironment: configuration.missing,
      scopes: config.scopes,
    }, 409);
  }

  try {
    const state = createOAuthState(slot);
    const authorizationUrl = buildAuthorizationUrl(slot, url.origin, state);
    return json({
      slot,
      provider: config.provider,
      scopes: config.scopes,
      authorizationUrl,
      callbackUrl: `${url.origin}/.netlify/functions/oauth-callback`,
    });
  } catch (error) {
    return json({ error: error.message || 'Unable to start authorization' }, 500);
  }
};
