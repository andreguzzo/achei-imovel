import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, Heart, Menu, X, Globe, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

const Header = () => {
  const { t, locale, toggleLocale } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: t.nav.buy, href: "/busca?tipo=comprar" },
    { label: t.nav.rent, href: "/busca?tipo=alugar" },
    { label: t.nav.sell, href: "/anunciar" },
    { label: t.nav.financing, href: "/financiamento" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <Home className="h-7 w-7 text-primary" />
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Lar<span className="text-primary">Brasil</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLocale}
            aria-label="Toggle language"
            className="text-muted-foreground"
          >
            <Globe className="h-5 w-5" />
          </Button>
          <span className="hidden text-xs font-medium text-muted-foreground md:inline">
            {locale === "pt-BR" ? "PT" : "EN"}
          </span>

          <Link to="/favoritos" className="hidden md:inline-flex">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Heart className="h-5 w-5" />
            </Button>
          </Link>

          {user ? (
            <>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex gap-1 text-muted-foreground" onClick={() => navigate("/painel")}>
                <User className="h-4 w-4" /> {t.nav.myAccount}
              </Button>
              <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => signOut()}>
                <LogOut className="h-4 w-4 mr-1" /> {t.nav.logout}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden md:inline-flex">
                <Button variant="outline" size="sm">{t.nav.login}</Button>
              </Link>
              <Link to="/cadastro" className="hidden md:inline-flex">
                <Button size="sm">{t.nav.signup}</Button>
              </Link>
            </>
          )}

          {/* Mobile toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="border-t bg-card p-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2 border-border" />
            <Link to="/favoritos" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Heart className="h-4 w-4" /> {t.nav.favorites}
              </Button>
            </Link>
            {user ? (
              <>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => { navigate("/painel"); setMobileOpen(false); }}>
                  <User className="h-4 w-4" /> {t.nav.myAccount}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { signOut(); setMobileOpen(false); }}>
                  <LogOut className="h-4 w-4 mr-1" /> {t.nav.logout}
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" className="w-full">{t.nav.login}</Button>
                </Link>
                <Link to="/cadastro" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full">{t.nav.signup}</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
