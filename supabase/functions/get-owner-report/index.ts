import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    let token = url.searchParams.get('token') ?? ''
    if (!token && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      token = typeof body?.token === 'string' ? body.token : ''
    }

    if (!/^[a-f0-9]{16,128}$/i.test(token)) {
      return json({ error: 'Link inválido.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await admin
      .from('owner_reports')
      .select('period_start, period_end, summary, created_at, expires_at, metrics')
      .eq('share_token', token)
      .maybeSingle()

    if (error) return json({ error: 'Não foi possível carregar o relatório.' }, 500)
    if (!data) return json({ error: 'Relatório não encontrado.' }, 404)
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
      return json({ error: 'Este link expirou. Solicite um novo relatório ao corretor.' }, 410)
    }

    const m = (data.metrics ?? {}) as Record<string, unknown>
    const p = (m.property ?? {}) as Record<string, unknown>
    const broker = (m.broker ?? {}) as Record<string, unknown>

    return json({
      period_start: data.period_start,
      period_end: data.period_end,
      summary: data.summary,
      created_at: data.created_at,
      metrics: {
        property: {
          title: p.title ?? null,
          reference_code: p.reference_code ?? null,
          property_type: p.property_type ?? null,
          listing_type: p.listing_type ?? null,
          status: p.status ?? null,
          price: p.price ?? null,
          area: p.area ?? null,
          bedrooms: p.bedrooms ?? null,
          bathrooms: p.bathrooms ?? null,
          suites: p.suites ?? null,
          parking_spots: p.parking_spots ?? null,
          neighborhood: p.neighborhood ?? null,
          city: p.city ?? null,
          state: p.state ?? null,
          published_at: p.published_at ?? null,
          cover_url: p.cover_url ?? null,
        },
        broker: {
          name: broker.name ?? null,
          creci: broker.creci ?? null,
          phone: broker.phone ?? null,
        },
        views: m.views ?? 0,
        leads: m.leads ?? 0,
        visits_scheduled: m.visits_scheduled ?? 0,
        visits_done: m.visits_done ?? 0,
        channels: Array.isArray(m.channels) ? m.channels : [],
        comparison: m.comparison ?? null,
      },
    })
  } catch (_e) {
    return json({ error: 'Erro inesperado ao carregar o relatório.' }, 500)
  }
})
