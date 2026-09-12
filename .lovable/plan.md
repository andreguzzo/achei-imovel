# Exportar anúncios como post para Instagram/Facebook

O corretor abre um imóvel no painel, clica em "Exportar para redes sociais" e recebe um post pronto: imagem (única ou carrossel) com a legenda gerada por IA. Em uma segunda etapa, a publicação direta na conta do Instagram/Facebook.

## Etapa 1 — Post pronto para compartilhar (funciona hoje)

Novo botão "Exportar post" no card de cada imóvel do painel e na página de edição, abrindo um painel lateral com:

- **Escolha do formato**: imagem única (1080x1080) ou carrossel (até 10 imagens 1080x1350).
- **Pré-visualização** do post no formato escolhido, com as fotos do imóvel, preço, cidade/bairro, quartos, banheiros, área e a marca do corretor (nome, foto de perfil, CRECI, telefone).
- **Legenda gerada por IA** em português, com título chamativo, destaques do imóvel, localização, preço, chamada para contato e hashtags locais. Botões para regenerar, editar à mão e copiar.
- **Baixar imagens** (uma a uma ou todas) e **copiar legenda**, prontos para postar pelo celular.
- **Compartilhar direto** pelo celular usando o compartilhamento nativo, quando disponível, já com as imagens e a legenda.

As imagens do post são montadas no próprio navegador em cima das fotos já cadastradas, sem custo extra de armazenamento.

Cada exportação fica registrada no histórico do imóvel (data, formato, legenda usada), para o corretor não repetir o mesmo post.

## Etapa 2 — Publicação automática (depende da Meta)

A estrutura já fica preparada para publicar direto, mas ela só liga depois que você tiver um aplicativo aprovado na Meta. O que é necessário do seu lado:

1. Criar um aplicativo no Meta for Developers (tipo Business).
2. Vincular cada conta de Instagram usada a uma Página do Facebook e convertê-la em conta Profissional/Comercial — é exigência da Meta para publicar por API.
3. Passar pela revisão da Meta pedindo as permissões de publicação de conteúdo e gestão de páginas (leva alguns dias e exige vídeo demonstrando o fluxo).
4. Me enviar o ID e a chave secreta do aplicativo para eu guardar em segurança.

Depois disso, cada corretor conecta a própria conta no painel ("Conectar Instagram/Facebook"), escolhe a conta/página e passa a publicar com um clique — imagem única ou carrossel, com a mesma legenda. Vou deixar já pronta a tela de "Contas conectadas" no painel, desativada com um aviso de "em breve" até as credenciais existirem.

## Detalhes técnicos

- **Geração da imagem**: canvas no cliente — desenha a foto do imóvel (cover), gradiente inferior, textos de preço/local/atributos e a marca do corretor; exporta JPEG 90%. Reaproveita a compressão existente em `src/lib/imageCompression.ts`. Novo `src/lib/socialPostRenderer.ts`.
- **Legenda por IA**: nova Edge Function `generate-social-caption` chamando o Lovable AI Gateway (`openai/gpt-6-astra` via `/v1/responses`, streaming, reasoning `low`), validando JWT do corretor e recebendo os dados do imóvel; retorna legenda + hashtags. Segue o mesmo padrão de `generate-property-description`.
- **UI**: `src/components/social/SocialPostExporter.tsx` (sheet com preview, formato, legenda, download, Web Share API com `navigator.canShare({ files })`); botão adicionado na aba de imóveis do dashboard e em `CreateProperty`.
- **Banco**: tabela `social_post_exports` (`id`, `property_id`, `broker_id`, `format`, `caption`, `created_at`) com RLS por `broker_id` + política de admin, e GRANTs para `authenticated`/`service_role`. Tabela `social_accounts` (`broker_id`, `provider`, `external_id`, `username`, `page_id`, `access_token`, `token_expires_at`) criada já com RLS restrita (sem `anon`), preenchida só na Etapa 2.
- **Etapa 2 (esqueleto)**: rotas de OAuth e publicação (`social-connect-callback`, `publish-social-post`) só serão criadas quando as credenciais da Meta existirem; até lá a UI mostra estado desabilitado.
- **i18n**: novas chaves pt-BR/en para todos os textos.
