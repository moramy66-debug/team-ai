const PROVIDERS = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    authHeader: (key) => ({ 'x-goog-api-key': key }),
    envKey: 'GEMINI_API_KEY'
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    envKey: 'GROQ_API_KEY'
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    envKey: 'OPENROUTER_API_KEY'
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    envKey: 'OPENAI_API_KEY'
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    authHeader: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    envKey: 'ANTHROPIC_API_KEY'
  }
};

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '*';
  const allowedOrigin = env.ALLOWED_ORIGIN || 'https://moramy66-debug.github.io';
  const allowOrigin = allowedOrigin === '*' ? origin : (origin === allowedOrigin ? origin : allowedOrigin);
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-goog-api-key, x-api-key, anthropic-version',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/api\/([a-z]+)(\/.*)?$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Invalid endpoint. Use /api/{provider}/{path}' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const [, providerName, subPath = ''] = match;
    const provider = PROVIDERS[providerName];
    if (!provider) {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${providerName}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = env[provider.envKey];
    if (!apiKey) {
      return new Response(JSON.stringify({ error: `Missing secret ${provider.envKey} in Worker environment` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetUrl = `${provider.baseUrl}${subPath}${url.search}`;
    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.delete('Origin');
    headers.delete('Referer');

    const authHeaders = provider.authHeader(apiKey);
    for (const [k, v] of Object.entries(authHeaders)) {
      headers.set(k, v);
    }

    const upstreamRequest = new Request(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
    });

    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      responseHeaders.set(k, v);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders
    });
  }
};
