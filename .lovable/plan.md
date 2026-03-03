

# Atribuir role broker + fluxo automático via CRECI

## Situação atual
- Tabela `user_roles` está vazia, nenhum usuário tem role.
- O usuário Andre Guzzo (user_id: `bcb8d2f3-61ea-4b44-8e1f-4fd5f39404e9`) tem CRECI cadastrado mas não tem role broker.
- A aba Corretor no Dashboard só aparece quando `has_role(user_id, 'broker')` retorna true.

## Plano

### 1. Migração SQL
- Inserir role `broker` para o usuário existente com CRECI preenchido.
- Criar trigger na tabela `profiles`: quando `creci` é atualizado de NULL/vazio para um valor preenchido, automaticamente insere role `broker` em `user_roles`. Quando CRECI é removido, remove o role.

### 2. Nenhuma mudança de frontend necessária
- O Dashboard já verifica `has_role` e mostra a aba Corretor condicionalmente.

### Migração SQL a executar:
```sql
-- Assign broker role to existing users with CRECI
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'broker'::app_role
FROM public.profiles p
WHERE p.creci IS NOT NULL AND trim(p.creci) != ''
ON CONFLICT (user_id, role) DO NOTHING;

-- Auto-assign broker role when CRECI is set
CREATE OR REPLACE FUNCTION public.sync_broker_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.creci IS NOT NULL AND trim(NEW.creci) != '' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'broker'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'broker'::app_role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_broker_role
AFTER INSERT OR UPDATE OF creci ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_broker_role();
```

