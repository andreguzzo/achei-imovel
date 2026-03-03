import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t bg-card">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="font-display text-lg font-bold text-foreground">
                Lar<span className="text-primary">Brasil</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t.hero.subtitle}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{t.footer.about}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/sobre" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.about}</Link></li>
              <li><Link to="/contato" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.contact}</Link></li>
              <li><Link to="/ajuda" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.help}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/termos" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.terms}</Link></li>
              <li><Link to="/privacidade" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.privacy}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{t.nav.sell}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/anunciar" className="text-muted-foreground hover:text-foreground transition-colors">{t.footer.advertise}</Link></li>
              <li><Link to="/financiamento" className="text-muted-foreground hover:text-foreground transition-colors">{t.nav.financing}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} LarBrasil. {t.footer.rights}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
