

## Revisão Completa do Sistema — Problemas Identificados

Após análise detalhada de todos os arquivos do projeto, identifiquei os seguintes problemas organizados por prioridade:

---

### 1. Erro de Console: Badge sem forwardRef (DashboardSalesTab)

O console mostra warning: `Function components cannot be given refs` no `Badge` dentro de `DashboardSalesTab`. Isso ocorre porque o `Badge` é usado dentro de um `TabsTrigger` (que tenta passar ref), mas o componente `Badge` não usa `forwardRef`.

**Correção:** Não é o Badge em si — o problema é que o Badge é renderizado como filho direto de algum componente que espera ref. Verificar se há Badges usados como `asChild` em algum slot.

---

### 2. PropertyDetail não incrementa view_count

A página de detalhe do imóvel (`PropertyDetail.tsx`) não faz `UPDATE` para incrementar o `view_count` ao ser visualizada. O campo existe na tabela mas nunca é atualizado.

**Correção:** Adicionar um `useEffect` que faz `supabase.rpc` ou `update` para incrementar `view_count` no carregamento da página.

---

### 3. PropertyDetail não mostra mapa do imóvel

Apesar de termos coordenadas (`latitude`, `longitude`) nos imóveis e o `PropertyMap` / `LocationPicker` disponíveis, a página de detalhe do imóvel não exibe um mapa com a localização.

**Correção:** Adicionar um mini-mapa com a localização e botão de compartilhar na página de detalhe.

---

### 4. Sem página de edição de imóvel

O botão de "Editar" no Dashboard leva para `/imovel/:id` (a página pública de detalhe), não para uma página de edição. O corretor não consegue editar um imóvel após criá-lo.

**Correção:** Criar uma rota `/editar/:id` ou reutilizar `CreateProperty` com modo de edição.

---

### 5. Contatos recebidos sem filtro por broker

No `DashboardSalesTab`, a query de `contact_requests` não filtra pelo broker atual — ela carrega todos os contatos que o RLS permite ver. Porém o RLS só permite ver contatos onde o user é `sender_id` OU dono da propriedade. Funciona pelo RLS, mas não filtra apenas os contatos recebidos (exclui os enviados).

**Correção:** Filtrar contatos onde o user é dono do imóvel, não o remetente.

---

### 6. Partnerships criam property_groups "fantasma"

No `DashboardSalesTab`, ao criar uma parceria direta (sem imóvel), é inserido um `property_groups` com `canonical_address: 'partnership-...'`, `city: 'N/A'`, `state: 'N/A'`. Isso polui a tabela de grupos. Contudo, o INSERT na `property_groups` requer permissão, e o RLS atual **bloqueia INSERT** para usuários normais — isso provavelmente **falha silenciosamente**.

**Correção:** Criar uma database function `SECURITY DEFINER` para criar grupos de parceria, ou adicionar política de INSERT para brokers.

---

### 7. Suítes não exibidas no PropertyCard nem PropertyDetail

O campo `suites` é coletado no formulário de criação mas não é exibido no `PropertyCard` nem no `PropertyDetail`.

**Correção:** Adicionar exibição de suítes nos componentes de visualização.

---

### 8. BrokerProposals: formPropertyId com valor "none"

Quando o usuário seleciona "Nenhum" no select de imóvel, o `formPropertyId` é definido como `"none"` (string), que é enviado como `property_id: "none"` — isso falhará pois o campo é UUID nullable. Deveria ser `null`.

**Correção:** Tratar `"none"` como string vazia ou null antes de salvar.

---

### 9. LocationPicker: mapa não recria ao fechar e reabrir

O `useEffect` que inicializa o mapa tem `[showMap]` como dependência mas verifica `mapInstanceRef.current` — ao fechar e reabrir, a instância antiga permanece referenciada mas o DOM foi destruído, podendo causar erros.

**Correção:** O cleanup function já faz `map.remove()` e nullifica refs, então isso deveria funcionar. Porém, as dependências `onLatChange`/`onLngChange` não estão no array de deps e podem ficar stale.

---

### 10. Signed URLs para documentos privados expiram

`PrivateInfoCard` gera signed URLs de 10 anos para documentos privados. Porém, se o bucket é privado, o acesso depende dessas URLs. Se a URL expirar ou se o token for invalidado, os documentos ficam inacessíveis. Melhor armazenar o path e gerar URLs sob demanda.

**Correção:** Armazenar o `path` no banco e gerar signed URLs apenas quando o broker acessar os documentos.

---

### Plano de Implementação (priorizado)

| # | Problema | Arquivo(s) | Complexidade |
|---|----------|-----------|-------------|
| 1 | Badge forwardRef warning | `DashboardSalesTab.tsx` | Baixa |
| 2 | view_count não incrementa | `PropertyDetail.tsx` | Baixa |
| 3 | Mapa ausente no detalhe | `PropertyDetail.tsx` | Média |
| 4 | Sem edição de imóvel | `CreateProperty.tsx`, `App.tsx` | Alta |
| 5 | Contatos sem filtro por broker | `DashboardSalesTab.tsx` | Baixa |
| 6 | Partnership groups sem permissão INSERT | Migration SQL | Média |
| 7 | Suítes não exibidas | `PropertyCard.tsx`, `PropertyDetail.tsx` | Baixa |
| 8 | formPropertyId "none" como UUID | `BrokerProposals.tsx` | Baixa |
| 9 | Signed URLs de documentos | `PrivateInfoCard.tsx` | Média |

Sugiro implementar na ordem: 1, 2, 5, 7, 8 (correções rápidas), depois 3, 6, 4, 9 (mais complexas).

