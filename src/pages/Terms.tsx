import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { CONTROLLER, TERMS_VERSION } from "@/lib/legal";

const Terms = () => (
  <div className="container max-w-3xl py-12">
    <Seo
      title="Termos de Uso | Abitzo"
      description="Regras de uso da plataforma Abitzo para corretores, imobiliárias, proprietários, inquilinos e interessados em imóveis."
      canonical="/termos"
      type="article"
    />

    <h1 className="font-display text-3xl font-bold text-foreground">Termos de Uso</h1>
    <p className="mt-2 text-sm text-muted-foreground">Versão {TERMS_VERSION}.</p>

    <div className="prose prose-sm mt-8 max-w-none space-y-8 text-foreground">
      <section>
        <h2 className="text-xl font-semibold">1. Objeto</h2>
        <p className="text-muted-foreground">
          O Abitzo é uma plataforma de anúncio e gestão imobiliária. Oferecemos ferramentas de divulgação de
          imóveis, gestão de clientes, negociações, parcerias entre corretores e administração de locação.
          Não somos parte nas negociações, não intermediamos a compra, venda ou locação e não garantimos
          resultado comercial.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">2. Cadastro e tipos de conta</h2>
        <ul className="list-disc pl-5 text-muted-foreground">
          <li><strong>Proprietário:</strong> conta gratuita, limitada a um anúncio do próprio imóvel.</li>
          <li><strong>Corretor:</strong> anúncios ilimitados após validação do CRECI.</li>
          <li><strong>Imobiliária:</strong> equipe com múltiplos usuários e permissões por funcionalidade.</li>
        </ul>
        <p className="text-muted-foreground">
          As informações do cadastro devem ser verdadeiras e atualizadas. É proibido criar conta profissional
          sem registro CRECI válido. Você é responsável pela guarda das suas credenciais.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">3. Responsabilidade pelo conteúdo</h2>
        <p className="text-muted-foreground">
          O anunciante é integralmente responsável pelo conteúdo publicado: fotos, descrição, preço,
          metragem, características e autorização do proprietário para divulgar o imóvel. É proibido publicar
          imóveis sem autorização, dados falsos, conteúdo de terceiros sem direito de uso ou informação
          discriminatória. Podemos remover anúncios e suspender contas que violem estas regras.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">4. Dados de terceiros inseridos por você</h2>
        <p className="text-muted-foreground">
          Ao cadastrar proprietários, inquilinos e clientes, você declara ter base legal para tratar esses
          dados e atua como controlador em relação a eles. Use os dados apenas para a finalidade imobiliária
          declarada e mantenha sigilo sobre documentos e informações sensíveis.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">5. Planos, pagamento e cancelamento</h2>
        <p className="text-muted-foreground">
          As assinaturas profissionais são mensais, cobradas pelo Stripe, com renovação automática até o
          cancelamento. O cancelamento encerra o acesso ao fim do período já pago, sem devolução proporcional.
          Preços podem ser reajustados com aviso prévio.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">6. Gestão de locação e cobranças</h2>
        <p className="text-muted-foreground">
          As ferramentas de contratos, cobranças e repasses são de apoio à gestão do corretor. O Abitzo não é
          instituição de pagamento, não retém valores de aluguel e não responde por obrigações do contrato de
          locação firmado entre as partes.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">7. Parcerias entre corretores</h2>
        <p className="text-muted-foreground">
          As condições de parceria e o rateio de comissão registrados na plataforma refletem o acordo entre os
          corretores envolvidos. O Abitzo apenas registra e organiza essas informações.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">8. Suspensão e encerramento</h2>
        <p className="text-muted-foreground">
          Podemos suspender ou encerrar contas em caso de fraude, uso indevido, inadimplência ou violação
          destes termos. Você pode encerrar sua conta a qualquer momento em Painel → Perfil → Meus dados.
          Registros financeiros e fiscais são retidos pelos prazos legais.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">9. Limitação de responsabilidade</h2>
        <p className="text-muted-foreground">
          A plataforma é fornecida no estado em que se encontra. Não respondemos por indisponibilidades de
          terceiros, perdas comerciais indiretas ou pelo conteúdo publicado por usuários.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">10. Foro e contato</h2>
        <p className="text-muted-foreground">
          Aplica-se a legislação brasileira. Dúvidas e solicitações: <strong>{CONTROLLER.email}</strong>.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        Veja também a{" "}
        <Link to="/privacidade" className="text-primary underline underline-offset-2">Política de Privacidade</Link>.
      </p>
    </div>
  </div>
);

export default Terms;
