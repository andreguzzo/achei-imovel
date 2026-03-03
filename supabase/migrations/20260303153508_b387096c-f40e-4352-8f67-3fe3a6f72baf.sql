
-- Create a system user for seed data
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'sistema@larbrasil.com',
  crypt('system_seed_2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Sistema LarBrasil"}'
);

-- Seed properties
INSERT INTO public.properties (user_id, title, description, property_type, listing_type, price, area, bedrooms, bathrooms, parking_spots, neighborhood, city, state, address, iptu, condo_fee, features) VALUES
('a0000000-0000-0000-0000-000000000001', 'Apartamento Moderno em Copacabana', 'Lindo apartamento com vista para o mar, totalmente reformado. 3 quartos sendo 1 suíte, sala ampla com varanda gourmet.', 'apartment', 'sale', 1250000, 120, 3, 2, 2, 'Copacabana', 'Rio de Janeiro', 'RJ', 'Av. Atlântica, 1200', 850, 1200, ARRAY['Vista para o mar', 'Varanda gourmet', 'Portaria 24h', 'Piscina']),
('a0000000-0000-0000-0000-000000000001', 'Casa Espaçosa no Jardim Europa', 'Casa de alto padrão com 4 suítes, piscina aquecida, jardim e churrasqueira. Localização privilegiada.', 'house', 'sale', 3500000, 450, 4, 5, 4, 'Jardim Europa', 'São Paulo', 'SP', 'Rua das Flores, 300', 2500, NULL, ARRAY['Piscina aquecida', 'Churrasqueira', 'Jardim', 'Home office', 'Segurança']),
('a0000000-0000-0000-0000-000000000001', 'Studio na Vila Madalena', 'Studio compacto e funcional, ideal para jovens profissionais. Próximo ao metrô e comércios.', 'apartment', 'rent', 2800, 35, 1, 1, 0, 'Vila Madalena', 'São Paulo', 'SP', 'Rua Harmonia, 50', NULL, 450, ARRAY['Próximo ao metrô', 'Mobiliado', 'Academia']),
('a0000000-0000-0000-0000-000000000001', 'Cobertura Duplex na Barra', 'Espetacular cobertura duplex com 5 quartos, terraço panorâmico e 3 vagas de garagem.', 'apartment', 'sale', 4200000, 350, 5, 4, 3, 'Barra da Tijuca', 'Rio de Janeiro', 'RJ', 'Av. Lúcio Costa, 800', 1500, 2800, ARRAY['Cobertura duplex', 'Terraço panorâmico', 'Lazer completo', 'Vista mar']),
('a0000000-0000-0000-0000-000000000001', 'Terreno no Condomínio Alphaville', 'Terreno plano de 600m² em condomínio fechado com infraestrutura completa.', 'land', 'sale', 890000, 600, 0, 0, 0, 'Alphaville', 'Barueri', 'SP', 'Alameda Viena, Lote 45', 300, 600, ARRAY['Condomínio fechado', 'Terreno plano', 'Infraestrutura completa']),
('a0000000-0000-0000-0000-000000000001', 'Sala Comercial no Centro', 'Sala comercial de 80m² no centro empresarial, com ar-condicionado central e 1 vaga.', 'commercial', 'rent', 3500, 80, 0, 1, 1, 'Centro', 'Curitiba', 'PR', 'Rua XV de Novembro, 500', NULL, 800, ARRAY['Ar-condicionado central', 'Recepção', 'Segurança']),
('a0000000-0000-0000-0000-000000000001', 'Apartamento Garden em Moema', 'Garden com área privativa de 60m², 2 quartos, churrasqueira e pet friendly.', 'apartment', 'sale', 980000, 110, 2, 2, 1, 'Moema', 'São Paulo', 'SP', 'Rua Canário, 200', 650, 900, ARRAY['Garden', 'Churrasqueira', 'Pet friendly', 'Lazer']),
('a0000000-0000-0000-0000-000000000001', 'Casa de Praia em Floripa', 'Casa de praia com 3 quartos a 200m da praia de Jurerê. Perfeita para temporada.', 'house', 'rent', 8500, 180, 3, 2, 2, 'Jurerê Internacional', 'Florianópolis', 'SC', 'Rua das Gaivotas, 150', NULL, NULL, ARRAY['Próximo à praia', 'Churrasqueira', 'Garagem']),
('a0000000-0000-0000-0000-000000000001', 'Loft Industrial na República', 'Loft estilo industrial com pé-direito alto, cozinha integrada e 1 vaga. Próximo ao centro histórico.', 'apartment', 'rent', 4200, 65, 1, 1, 1, 'República', 'São Paulo', 'SP', 'Rua Aurora, 100', NULL, 600, ARRAY['Pé-direito alto', 'Estilo industrial', 'Cozinha integrada']);
