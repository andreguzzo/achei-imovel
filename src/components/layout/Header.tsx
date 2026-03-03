import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Home, Heart, Menu, X, Globe, LogOut, User, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";

const Header = () => {
  const { t, locale, toggleLocale } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isBroker, setIsBroker] = useState(false);

  useEffect(() => {
    if (!user) { setIsBroker(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "broker" }).then(({ data }) => {
      setIsBroker(!!data);
    });
  }, [user]);

  const navLinks = [
    { label: t.nav.buy, href: "/busca?tipo=comprar" },
    { label: t.nav.rent, href: "/busca?tipo=alugar" },
    { label: t.nav.sell, href: "/anunciar" },
    { label: t.nav.financing, href: "/financiamento" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <Home className="h-7 w-7 text-primary transition-transform group-hover:scale-110" />
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Abit<span className="text-primary">zo</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="relative rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground group"
            >
              {link.label}
              <span className="absolute inset-x-3 -bottom-[1px] h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLocale}
            aria-label="Toggle language"
            className="text-muted-foreground hover:text-foreground"
          >
            <Globe className="h-5 w-5" />
          </Button>
          <span className="hidden text-xs font-semibold text-muted-foreground md:inline">
            {locale === "pt-BR" ? "PT" : "EN"}
          </span>

          <Link to="/favoritos" className="hidden md:inline-flex">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Heart className="h-5 w-5" />
            </Button>
          </Link>

          {user ? (
            <>
              <Button variant="ghost" size="sm" className="hidden md:inline-flex gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => navigate("/painel")}>
                <User className="h-4 w-4" /> {t.nav.myAccount}
              </Button>
              <Button variant="outline" size="sm" className="hidden md:inline-flex gap-1.5" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" /> {t.nav.logout}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden md:inline-flex">
                <Button variant="outline" size="sm">{t.nav.login}</Button>
              </Link>
              <Link to="/planos" className="hidden md:inline-flex">
                <Button size="sm" className="gap-1.5"><Crown className="h-4 w-4" /> {locale === "pt-BR" ? "Planos" : "Plans"}</Button>
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
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t bg-card md:hidden"
          >
            <nav className="flex flex-col gap-1 p-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
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
                  <Button variant="outline" className="w-full mt-1" onClick={() => { signOut(); setMobileOpen(false); }}>
                    <LogOut className="h-4 w-4 mr-1" /> {t.nav.logout}
                  </Button>
                </>
              ) : (
                <div className="flex gap-2 mt-1">
                  <Link to="/login" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full">{t.nav.login}</Button>
                  </Link>
                  <Link to="/planos" className="flex-1" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full gap-1"><Crown className="h-4 w-4" /> {locale === "pt-BR" ? "Planos" : "Plans"}</Button>
                  </Link>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
