import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { CONTROLLER, PRIVACY_VERSION } from "@/lib/legal";

const Privacy = () => (
  <div className="container max-w-3xl py-12">
    <Seo
      title="Política de Privacidade | Abitzo"
      description="Como o Abitzo coleta, usa, compartilha e protege dados pessoais de corretores, proprietários, inquilinos e interessados, conforme a LGPD."
      canonical="/privacidade"
      type="article"
    />

    <h1 className="font-display text-3xl font-bold text-foreground">Política de Privacidade</h1>
    <p className="mt-2 text-sm text-muted-foreground">
      Versão {PRIVACY_VERSION}. Esta política explica como tratamos dados pessoais na plataforma Abitzo,
      em conformidade com a Lei nº 13.709/2018 (LGPD).
    </p>

    <div className="prose prose-sm mt-8 max-w-none space-y-8 text-foreground">
      <section>
        <h2 className="text-xl font-semibold">1. Quem é o controlador</h2>
        <p className="text-muted-foreground">
          O controlador dos dados tratados na plataforma é <strong>{CONTROLLER.name}</strong>. Corretores,
          imobiliárias e proprietários que usam a plataforma para gerir suas próprias carteiras atuam como
          controladores dos dados dos seus clientes, e o Abitzo atua como operador nessas atividades.
        </p>
        <p className="text-muted-foreground">
          Canal de contato do controlador e do encarregado (DPO): <strong>{CONTROLLER.email}</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">2. Quais dados coletamos</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            <strong>Corretores e imobiliárias:</strong> nome, nome comercial, e-mail, telefone, WhatsApp,
            CRECI, CNPJ, redes sociais, foto, biografia, documentos enviados para verificação de identidade
            profissional e dados de assinatura e pagamento (processados pelo Stripe).
          </li>
          <li>
            <strong>Proprietários:</strong> nome, telefone, e-mail, CPF, endereço, dados da autorização de
            venda e documentos anexados pelo corretor responsável.
          </li>
          <li>
            <strong>Inquilinos:</strong> nome, telefone, e-mail, CPF, dados do contrato de locação, valores,
            garantias, vistorias e histórico de cobranças.
          </li>
          <li>
            <strong>Interessados e visitantes:</strong> nome, e-mail, telefone, mensagem enviada no formulário
            de contato, imóveis favoritados, buscas salvas e registros técnicos como endereço IP, navegador,
            data e hora de acesso.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold">3. Finalidades e bases legais</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>
            Criar e manter a conta, autenticar o acesso e prestar o serviço contratado —
            <em> execução de contrato</em> (art. 7º, V).
          </li>
          <li>
            Encaminhar contatos de interessados ao corretor responsável pelo anúncio —
            <em> consentimento</em> do interessado (art. 7º, I) e <em>legítimo interesse</em> na intermediação.
          </li>
          <li>
            Verificar a identidade profissional e o registro CRECI, prevenindo fraude —
            <em> legítimo interesse</em> e <em>cumprimento de obrigação legal ou regulatória</em>.
          </li>
          <li>
            Gerir contratos de locação, cobranças e repasses — <em>execução de contrato</em> e
            <em> cumprimento de obrigação legal</em>.
          </li>
          <li>
            Emitir e conservar registros financeiros, fiscais e de faturamento —
            <em> cumprimento de obrigação legal</em> (art. 7º, II).
          </li>
          <li>
            Segurança, prevenção a abusos, registros de acesso e melhoria da plataforma —
            <em> legítimo interesse</em> (art. 7º, IX).
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold">4. Prazos de retenção</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li>Dados da conta: enquanto a conta existir e por até 6 meses após o encerramento.</li>
          <li>Registros de consentimento e de acesso a dados sensíveis: 5 anos, para fins de prova.</li>
          <li>Anúncios e mídias: até a exclusão pelo próprio usuário ou o encerramento da conta.</li>
          <li>
            Registros financeiros, fiscais e de contratos de locação: pelos prazos legais aplicáveis,
            em regra 5 anos, mesmo depois do pedido de exclusão da conta.
          </li>
          <li>Contatos de interessados: 24 meses, salvo conversão em negociação.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold">5. Compartilhamento</h2>
        <p className="text-muted-foreground">
          Compartilhamos dados apenas na medida necessária: com o corretor ou imobiliária responsável pelo
          anúncio ou contrato; com corretores parceiros quando houver parceria aprovada; com operadores de
          infraestrutura, pagamentos, mapas, e-mail transacional e cobrança; e com autoridades quando houver
          determinação legal. Não vendemos dados pessoais. Alguns operadores podem tratar dados fora do Brasil,
          sempre com cláusulas contratuais de proteção.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">6. Segurança</h2>
        <p className="text-muted-foreground">
          Aplicamos controle de acesso por usuário no banco de dados, criptografia em trânsito e em repouso,
          armazenamento privado para documentos, mascaramento de CPF na interface com registro de cada
          revelação, e criptografia dos tokens de integrações externas.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">7. Direitos do titular</h2>
        <p className="text-muted-foreground">
          Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade,
          eliminação, informação sobre compartilhamentos e revogação do consentimento. Usuários com conta
          encontram a exportação dos próprios dados em JSON e o pedido de exclusão em
          <strong> Painel → Perfil → Meus dados</strong>. Visitantes podem exercer os direitos escrevendo para
          {" "}<strong>{CONTROLLER.email}</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">8. Cookies e armazenamento local</h2>
        <p className="text-muted-foreground">
          Usamos armazenamento local para manter a sessão, guardar favoritos de visitantes não cadastrados,
          preferências de idioma e um identificador de visitante usado no registro de consentimento.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">9. Alterações</h2>
        <p className="text-muted-foreground">
          Podemos atualizar esta política. A versão vigente é sempre a exibida nesta página, identificada
          pela data no topo. Mudanças relevantes serão comunicadas na plataforma.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        Veja também os <Link to="/termos" className="text-primary underline underline-offset-2">Termos de Uso</Link>.
      </p>
    </div>
  </div>
);

export default Privacy;
