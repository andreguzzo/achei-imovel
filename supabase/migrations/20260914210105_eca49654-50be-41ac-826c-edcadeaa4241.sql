CREATE OR REPLACE FUNCTION public.canonical_feature_slug(_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  s := lower(trim(coalesce(_value, '')));
  s := translate(s, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '(^-+|-+$)', '', 'g');

  s := CASE s
    WHEN 'pet-friendly' THEN 'aceita-pet'
    WHEN 'pet' THEN 'aceita-pet'
    WHEN 'aceita-pets' THEN 'aceita-pet'
    WHEN 'portaria' THEN 'portaria-24h'
    WHEN 'portaria-24-h' THEN 'portaria-24h'
    WHEN 'portaria-24-horas' THEN 'portaria-24h'
    WHEN 'ar-condicionado-split' THEN 'ar-condicionado'
    WHEN 'salao-festas' THEN 'salao-de-festas'
    WHEN 'area-servico' THEN 'area-de-servico'
    WHEN 'vista-para-o-mar' THEN 'vista-mar'
    WHEN 'vista-do-mar' THEN 'vista-mar'
    WHEN 'poco' THEN 'poco-artesiano'
    WHEN 'home-office' THEN 'escritorio'
    WHEN 'quadra-esportiva' THEN 'quadra'
    WHEN 'quadra-poliesportiva' THEN 'quadra'
    ELSE s
  END;

  IF s = ANY (ARRAY[
    'elevador','piscina','academia','churrasqueira','portaria-24h','playground','salao-de-festas',
    'quadra','sauna','coworking','varanda','varanda-gourmet','sacada','suite','suite-master',
    'lavabo','closet','escritorio','cozinha-americana','area-de-servico','deposito','mobiliado',
    'ar-condicionado','jardim','quintal','vista-mar','energia-solar','poco-artesiano',
    'portao-eletronico','cerca-eletrica','aceita-pet','aceita-financiamento','aceita-permuta'
  ]) THEN
    RETURN s;
  END IF;

  RETURN NULL;
END;
$$;

UPDATE public.properties p
SET features = COALESCE(sub.slugs, '{}')
FROM (
  SELECT p2.id,
         array_agg(DISTINCT s) FILTER (WHERE s IS NOT NULL) AS slugs
  FROM public.properties p2
  LEFT JOIN LATERAL unnest(coalesce(p2.features, '{}')) AS raw(value) ON true
  LEFT JOIN LATERAL (SELECT public.canonical_feature_slug(raw.value) AS s) AS m ON true
  GROUP BY p2.id
) sub
WHERE sub.id = p.id
  AND coalesce(p.features, '{}') IS DISTINCT FROM COALESCE(sub.slugs, '{}');

DROP FUNCTION public.canonical_feature_slug(text);