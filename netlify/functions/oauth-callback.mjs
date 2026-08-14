import { getStore } from '@netlify/blobs';
import {
  exchangeAuthorizationCode,
  getConfigurationStatus,
  getSlotConfig,
  seal,
  verifyOAuthState,
} from '../lib/oauth.mjs';

const store = () => getStore({ name: 'social-connections', consistency: 'strong' });

function redirect(origin, params) {
  const url = new URL('/', origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return Response.redirect(url.toString(), 302);
}

export default async (req) => {
  const url = new URL(req.url);
  const origin = url.origin;
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const stateValue = url.searchParams.get('state');

  let state;
  try {
    state = verifyOAuthState(stateValue);
  } catch (stateError) {
    return redirect(origin, { oauth: 'failed', reason: stateError.message || 'Invalid OAuth state' });
  }

  const slot = state.slot;
  const config = getSlotConfig(slot);

  if (error) {
    await store().setJSON(slot, {
      connected: false,
      lastError: errorDescription || error,
      failedAt: new Date().toISOString(),
    });
    return redirect(origin, { oauth: 'failed', slot, reason: errorDescription || error });
  }

  const code = url.searchParams.get('code');
  if (!code) return redirect(origin, { oauth: 'failed', slot, reason: 'Authorization code was not returned' });

  const configuration = getConfigurationStatus(slot);
  if (!configuration.configured) {
    return redirect(origin, { oauth: 'failed', slot, reason: `Missing server configuration: ${configuration.missing.join(', ')}` });
  }

  try {
    const result = await exchangeAuthorizationCode(slot, code, origin);
    const record = {
      connected: true,
      provider: config.provider,
      public: result.public,
      credentials: seal(result.credentials),
      connectedAt: new Date().toISOString(),
      lastError: null,
    };
    await store().setJSON(slot, record);
    return redirect(origin, { oauth: 'success', slot });
  } catch (exchangeError) {
    await store().setJSON(slot, {
      connected: false,
      provider: config.provider,
      lastError: exchangeError.message || 'Authorization failed',
      failedAt: new Date().toISOString(),
    });
    return redirect(origin, { oauth: 'failed', slot, reason: exchangeError.message || 'Authorization failed' });
  }
};
