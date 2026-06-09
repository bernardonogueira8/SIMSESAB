import type { APIRoute } from 'astro';

const ENATJUS_BASE = 'https://www.pje.jus.br/e-natjus';

// Cache de sessão em memória (válido enquanto o servidor estiver rodando)
let sessionCache: { cookies: string; expiresAt: number } | null = null;

async function getSessionCookies(): Promise<string> {
  const now = Date.now();
  
  // Reutiliza sessão se ainda válida (cache de 10 minutos)
  if (sessionCache && sessionCache.expiresAt > now) {
    return sessionCache.cookies;
  }

  console.log('[e-NatJus] Obtendo nova sessão...');
  
  const response = await fetch(`${ENATJUS_BASE}/`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });

  // Coleta todos os Set-Cookie da resposta
  const rawCookies = response.headers.getSetCookie?.() ?? [];
  
  // Fallback para ambientes sem getSetCookie (Node < 18.14)
  const cookieHeader = response.headers.get('set-cookie');
  const allCookies = rawCookies.length > 0 
    ? rawCookies 
    : cookieHeader ? [cookieHeader] : [];

  if (allCookies.length === 0) {
    throw new Error('Nenhum cookie de sessão retornado pelo e-NatJus');
  }

  // Extrai apenas "Nome=Valor" de cada cookie (descarta path, httponly, etc.)
  const cookieString = allCookies
    .map(c => c.split(';')[0].trim())
    .join('; ');

  console.log('[e-NatJus] Cookies obtidos:', cookieString.substring(0, 80) + '...');

  sessionCache = {
    cookies: cookieString,
    expiresAt: now + 10 * 60 * 1000, // 10 minutos
  };

  return cookieString;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const term = url.searchParams.get('term');

  if (!term || term.length < 2) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const params = new URLSearchParams();
  params.append('term', term);
  params.append('create', 'false');

  try {
    const cookies = await getSessionCookies();

    const response = await fetch(`${ENATJUS_BASE}/api/buscar/medicamentoComercial`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': ENATJUS_BASE,
        'Referer': `${ENATJUS_BASE}/`,
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
      },
      body: params.toString(),
    });

    const textData = await response.text();

    console.log(`\n[API e-NatJus] Status: ${response.status}`);
    console.log(`[API e-NatJus] Termo: "${term}"`);
    console.log(`[API e-NatJus] Resposta RAW:`, textData.substring(0, 300));

    // Se recebeu HTML (bloqueio/redirect), a sessão expirou — invalida cache e tenta 1x
    if (textData.trimStart().startsWith('<')) {
      console.warn('[e-NatJus] Resposta HTML detectada, sessão inválida. Renovando...');
      sessionCache = null;

      const freshCookies = await getSessionCookies();
      const retryResponse = await fetch(`${ENATJUS_BASE}/api/buscar/medicamentoComercial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'applicatipair_9b453825f65e40d687f28337f0c95fadon/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': ENATJUS_BASE,
          'Referer': `${ENATJUS_BASE}/`,
          'Cookie': freshCookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
        },
        body: params.toString(),
      });

      const retryText = await retryResponse.text();
      try {
        const data = JSON.parse(retryText);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        console.error('[e-NatJus] Retry também retornou resposta inválida');
        return new Response(JSON.stringify({ error: 'Sessão inválida', results: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    let data;
    try {
      data = JSON.parse(textData);
    } catch {
      console.error('[Erro de Parse] Resposta não é JSON válido.');
      return new Response(JSON.stringify({ error: 'Retorno inválido', results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[e-NatJus] Falha na comunicação:', error);
    return new Response(JSON.stringify({ error: 'Falha na comunicação', results: [] }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};