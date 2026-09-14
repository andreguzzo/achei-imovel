# Plano de lançamento oficial — Abitzo

Objetivo: deixar o sistema pronto para operar em produção com domínio próprio, e-mails profissionais, cobranças reais e identidade verificada nos mecanismos de busca.

Sua lista está correta. Abaixo ela está organizada em etapas, com o que eu faço, o que depende de você e itens que faltavam na lista.

## Etapa 1 — Domínio (depende de você)
- Comprar o domínio (pode ser direto pelo Lovable em Configurações → Domínios, ou em registrador externo).
- Conectar `seudominio.com` e `www.seudominio.com`; definir um como principal.
- Aguardar propagação de DNS e emissão do certificado HTTPS (automático).
- Depois do domínio ativo: eu atualizo as URLs canônicas, sitemap, robots.txt e metadados para o domínio definitivo.

## Etapa 2 — E-mail (depende de você)
- Configurar o domínio de envio (ex.: `notify@seudominio.com`) pela ferramenta de e-mail — eu abro o assistente.
- Isso ativa: e-mails de cadastro/recuperação com a sua marca, notificações de contato de interessados, suporte e convites de equipe de imobiliária (hoje o convite é só link copiado — com e-mail configurado eu conecto o envio automático).
- Você acompanha os envios no painel Cloud → E-mails.

## Etapa 3 — Stripe em produção (depende de você + eu)
Você (no painel do Stripe):
1. Completar o cadastro da empresa e ativar a conta (modo live).
2. Criar o endpoint de webhook apontando para a URL que eu fornecer.
3. Colar o código de segurança do webhook no formulário seguro que eu abrir.

Eu:
- Criar os produtos/preços em modo live equivalentes aos de teste (Corretor R$ 79,90/mês e Imobiliária R$ 159,90/mês).
- Trocar as chaves para produção e validar: compra de teste real → liberação imediata do plano → registro na área Financeiro do admin.
- Ativar o portal do cliente no Stripe (para cancelamento/troca de plano pelo próprio usuário).

## Etapa 4 — Google (depende de você + eu)
- Google Maps: a chave atual bloqueia domínios não autorizados; adicionar o domínio oficial (e o de preview) nas restrições da chave no Google Cloud. Sem isso o mapa não abre no domínio novo.
- Login com Google: já funciona com credenciais gerenciadas; opcionalmente usar suas próprias credenciais para exibir sua marca na tela de consentimento.
- Search Console: verificar a propriedade do domínio, enviar o sitemap e acompanhar indexação.

## Etapa 5 — Itens que faltavam na sua lista (eu faço)
1. **Páginas legais (obrigatório no Brasil):** criar Termos de Uso e Política de Privacidade (LGPD) — o sistema coleta documentos de identidade, telefones e dados de imóveis, então isso é essencial antes de abrir ao público. Você revisa o texto com seu jurídico.
2. **Revisão de segurança:** corrigir os avisos pendentes do scanner (permissões de funções internas e exposição acidental do esquema). Nenhum é crítico hoje, mas devem ser saneados antes do lançamento.
3. **Dados de teste:** remover/limpar anúncios e valores de teste (ex.: CRECI fictício em perfil admin).
4. **Favicon e imagem de compartilhamento** com a marca final.
5. **Publicação:** clicar em Publicar e confirmar o domínio como principal.

## Etapa 6 — Testes finais por página (eu faço, com o domínio ativo)
Roteiro em produção, em desktop e celular:
- Home, busca (filtros, mapa, contagem), detalhe do imóvel (fotos, mapa, WhatsApp, formulário anônimo, compartilhar), página pública do corretor.
- Cadastro/login (e-mail, Google), recuperação de senha com e-mail de marca.
- Fluxo completo: proprietário grátis (1 anúncio), corretor (documento + verificação), imobiliária (convite de equipe e permissões).
- Compra de assinatura de ponta a ponta com cartão real de baixo valor, cancelamento pelo portal.
- Painel do corretor: criar/editar/excluir imóvel, vendas, locação, agenda.
- Painel admin: usuários, imóveis, planos, assinaturas, financeiro, suporte.
- Verificação de identidade por IA com documento real.

## Fora do escopo do lançamento (pode ficar para depois)
- Publicação direta Instagram/Facebook (exige app Meta e aprovação — o export manual de posts já funciona).
- Cobrança automática de aluguéis via Asaas/Mercado Pago por corretor (o controle manual já funciona).
- Login com Apple (exige conta Apple Developer paga).

## Ordem sugerida
1. Você: compra o domínio → 2. Eu: conecto e ajusto SEO → 3. E-mail → 4. Google Maps/Search Console → 5. Eu: páginas legais + segurança + limpeza → 6. Stripe live → 7. Testes finais → 8. Publicar.
