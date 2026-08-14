import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const SLOT_CONFIG = {
  'tiktok-1': {
    provider: 'tiktok',
    label: 'TikTok 1',
    scopes: ['user.info.basic', 'video.publish'],
    env: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
  },
  'tiktok-2': {
    provider: 'tiktok',
    label: 'TikTok 2',
    scopes: ['user.info.basic', 'video.publish'],
    env: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
  },
  instagram: {
    provider: 'instagram',
    label: 'Instagram',
    scopes: ['pages_show_list', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'],
    env: ['META_APP_ID', 'META_APP_SECRET', 'META_GRAPH_VERSION', 'TOKEN_ENCRYPTION_KEY'],
  },
  facebook: {
    provider: 'facebook',
    label: 'Facebook Page',
    scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    env: ['META_APP_ID', 'META_APP_SECRET', 'META_GRAPH_VERSION', 'TOKEN_ENCRYPTION_KEY'],
  },
  youtube: {
    provider: 'youtube',
    label: 'YouTube',
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
    ],
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'TOKEN_ENCRYPTION_KEY'],
  },
};

export const slots = Object.keys(SLOT_CONFIG);

export function getSlotConfig(slot) {
  return SLOT_CONFIG[slot] || null;
}

export function getConfigurationStatus(slot) {
  const config = getSlotConfig(slot);
  if (!config) return { configured: false, missing: ['unknown slot'] };
  const missing = config.env.filter((name) => !process.env[name]);
  return { configured: missing.length === 0, missing };
}

function callbackUrl(origin) {
  return `${origin}/.netlify/functions/oauth-callback`;
}

export function createOAuthState(slot) {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY is not configured');
  const payload = Buffer.from(JSON.stringify({
    slot,
    ts: Date.now(),
    nonce: randomBytes(16).toString('hex'),
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state) {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret || !state || !state.includes('.')) throw new Error('Invalid OAuth state');
  const [payload, suppliedSignature] = state.split('.');
  const expectedSignature = createHmac('sha256', secret).update(payload).digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error('OAuth state signature failed');
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!getSlotConfig(parsed.slot)) throw new Error('Unknown OAuth slot');
  if (!parsed.ts || Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error('OAuth state expired');
  return parsed;
}

export function buildAuthorizationUrl(slot, origin, state) {
  const config = getSlotConfig(slot);
  if (!config) throw new Error('Unknown account slot');
  const redirectUri = callbackUrl(origin);

  if (config.provider === 'tiktok') {
    const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.searchParams.set('client_key', process.env.TIKTOK_CLIENT_KEY);
    url.searchParams.set('scope', config.scopes.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return url.toString();
  }

  if (config.provider === 'youtube') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scopes.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    return url.toString();
  }

  const graphVersion = process.env.META_GRAPH_VERSION;
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', process.env.META_APP_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(','));
  url.searchParams.set('state', state);
  return url.toString();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok || data?.error) {
    const message = data?.error_description || data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function exchangeTikTok(code, origin) {
  const redirectUri = callbackUrl(origin);
  const token = await requestJson('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const profile = await requestJson('https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const user = profile?.data?.user || {};
  return {
    public: {
      accountId: user.open_id || token.open_id || null,
      displayName: user.display_name || 'TikTok account',
      avatarUrl: user.avatar_url || null,
      scopes: String(token.scope || '').split(',').filter(Boolean),
    },
    credentials: token,
  };
}

async function exchangeGoogle(code, origin) {
  const redirectUri = callbackUrl(origin);
  const token = await requestJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const channelData = await requestJson('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const channel = channelData?.items?.[0];
  if (!channel) throw new Error('No YouTube channel was found for this Google account');
  return {
    public: {
      accountId: channel.id,
      displayName: channel.snippet?.title || 'YouTube channel',
      avatarUrl: channel.snippet?.thumbnails?.default?.url || null,
      scopes: getSlotConfig('youtube').scopes,
    },
    credentials: token,
  };
}

async function exchangeMeta(slot, code, origin) {
  const redirectUri = callbackUrl(origin);
  const graphVersion = process.env.META_GRAPH_VERSION;
  const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  tokenUrl.searchParams.set('client_id', process.env.META_APP_ID);
  tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET);
  tokenUrl.searchParams.set('redirect_uri', redirectUri);
  tokenUrl.searchParams.set('code', code);
  const userToken = await requestJson(tokenUrl);

  const pagesUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
  pagesUrl.searchParams.set('fields', 'id,name,access_token,tasks,instagram_business_account');
  pagesUrl.searchParams.set('access_token', userToken.access_token);
  const pages = await requestJson(pagesUrl);

  if (slot === 'facebook') {
    const page = pages?.data?.[0];
    if (!page) throw new Error('No Facebook Page managed by this account was found');
    return {
      public: {
        accountId: page.id,
        displayName: page.name || 'Facebook Page',
        avatarUrl: null,
        scopes: getSlotConfig(slot).scopes,
      },
      credentials: {
        user_access_token: userToken.access_token,
        page_access_token: page.access_token,
        page_id: page.id,
      },
    };
  }

  const page = pages?.data?.find((item) => item.instagram_business_account?.id);
  if (!page) throw new Error('No Instagram Professional account linked to a managed Facebook Page was found');
  const igId = page.instagram_business_account.id;
  const igUrl = new URL(`https://graph.facebook.com/${graphVersion}/${igId}`);
  igUrl.searchParams.set('fields', 'id,username,name,profile_picture_url');
  igUrl.searchParams.set('access_token', page.access_token);
  const ig = await requestJson(igUrl);
  return {
    public: {
      accountId: ig.id || igId,
      displayName: ig.username ? `@${ig.username}` : (ig.name || 'Instagram Professional'),
      avatarUrl: ig.profile_picture_url || null,
      scopes: getSlotConfig(slot).scopes,
    },
    credentials: {
      user_access_token: userToken.access_token,
      page_access_token: page.access_token,
      page_id: page.id,
      ig_user_id: igId,
    },
  };
}

export async function exchangeAuthorizationCode(slot, code, origin) {
  const config = getSlotConfig(slot);
  if (!config) throw new Error('Unknown account slot');
  if (config.provider === 'tiktok') return exchangeTikTok(code, origin);
  if (config.provider === 'youtube') return exchangeGoogle(code, origin);
  return exchangeMeta(slot, code, origin);
}

function encryptionKey() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY is not configured');
  return createHash('sha256').update(secret).digest();
}

export function seal(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function unseal(value) {
  const [ivText, tagText, ciphertextText] = String(value || '').split('.');
  if (!ivText || !tagText || !ciphertextText) throw new Error('Invalid encrypted token payload');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}
