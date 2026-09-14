import { createClient } from 'npm:@supabase/supabase-js@2'

const BASE_URL = 'https://abitzo.lovable.app'
const MAX_URLS = 20000

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface Entry {
  path: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

function buildXml(entries: Entry[]) {
  const urls = entries.map((e) =>
    [
      '  <url>',
      `    <loc>${xmlEscape(BASE_URL + e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n'),
  )

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const entries: Entry[] = [
      { path: '/', changefreq: 'daily', priority: '1.0' },
      { path: '/busca', changefreq: 'daily', priority: '0.9' },
      { path: '/financiamento', changefreq: 'monthly', priority: '0.6' },
      { path: '/planos', changefreq: 'monthly', priority: '0.6' },
    ]

    let remaining = MAX_URLS - entries.length

    if (remaining > 0) {
      const { data: properties } = await supabase
        .from('properties')
        .select('id, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(Math.min(remaining, 10000))

      for (const p of properties ?? []) {
        entries.push({
          path: `/imovel/${p.id}`,
          lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
          changefreq: 'weekly',
          priority: '0.8',
        })
      }
      remaining = MAX_URLS - entries.length
    }

    if (remaining > 0) {
      const { data: brokers } = await supabase
        .from('profiles')
        .select('username')
        .not('username', 'is', null)
        .is('suspended_at', null)
        .limit(Math.min(remaining, 10000))

      for (const b of brokers ?? []) {
        if (!b.username) continue
        entries.push({
          path: `/corretor/${encodeURIComponent(b.username)}`,
          changefreq: 'weekly',
          priority: '0.7',
        })
      }
    }

    return new Response(buildXml(entries.slice(0, MAX_URLS)), {
      headers: {
        'content-type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (_e) {
    return new Response(buildXml([{ path: '/', changefreq: 'daily', priority: '1.0' }]), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  }
})
