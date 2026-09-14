import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t bg-card/50">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="font-display text-lg font-bold text-foreground">
                Abit<span className="text-primary">zo</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {t.hero.subtitle}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.footer.about}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/busca?tipo=comprar" className="text-muted-foreground hover:text-foreground transition-colors">{t.nav.buy}</Link></li>
              <li><Link to="/busca?tipo=alugar" className="text-muted-foreground hover:text-foreground transition-colors">{t.nav.rent}</Link></li>
              <li><Link to="/planos" className="text-muted-foreground hover:text-foreground transition-colors">{t.nav.financing}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.nav.sell}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/anunciar" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.advertise}</Link></li>
              <li><Link to="/financiamento" className="text-muted-foreground hover:text-foreground transition-colors">{t.nav.financing}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/termos" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.terms}</Link></li>
              <li><Link to="/privacidade" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.privacy}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Abitzo. {t.footer.rights}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
