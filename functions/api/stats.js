/**
 * Cloudflare Pages Function — /api/stats
 * 代理 EarthMC 官方 API，避免浏览器跨域问题，并精简返回字段。
 * 部署到 Cloudflare Pages 后自动生效，无需任何配置。
 */

const TOWN = 'Foshan';
const NATION = 'Ming';
const API = 'https://api.earthmc.net/v4';

async function query(endpoint, name) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: [name] }),
  });
  if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

const iso = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);

export async function onRequestGet() {
  try {
    const [town, nation] = await Promise.all([
      query('towns', TOWN),
      query('nations', NATION).catch(() => null),
    ]);

    if (!town) throw new Error('town not found');

    const payload = {
      ok: true,
      updated: new Date().toISOString(),
      town: {
        name: town.name,
        mayor: town.mayor?.name ?? null,
        founder: town.founder ?? null,
        nation: town.nation?.name ?? null,
        founded: iso(town.timestamps?.registered),
        joinedNation: iso(town.timestamps?.joinedNationAt),
        residents: town.stats?.numResidents ?? null,
        trusted: town.stats?.numTrusted ?? null,
        blocks: town.stats?.numTownBlocks ?? null,
        maxBlocks: town.stats?.maxTownBlocks ?? null,
        isOpen: town.status?.isOpen ?? null,
        isPublic: town.status?.isPublic ?? null,
      },
      nation: nation
        ? {
            name: nation.name,
            king: nation.king?.name ?? null,
            capital: nation.capital?.name ?? null,
            residents: nation.stats?.numResidents ?? null,
            towns: nation.stats?.numTowns ?? null,
            blocks: nation.stats?.numTownBlocks ?? null,
            founded: iso(nation.timestamps?.registered),
          }
        : null,
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err && err.message || err) }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
