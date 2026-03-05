import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border/50 mt-20 backdrop-blur-xl bg-background/60">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="w-12 h-12 bg-muted border border-border flex items-center justify-center mb-3 overflow-hidden">
              <img src="/placeholder.svg" alt="TWIBO.id logo" className="w-full h-full object-cover" />
            </div>
            <h3 className="font-display text-xl font-bold text-gold-gradient mb-3">TWIBO.id</h3>
            <p className="text-sm text-muted-foreground max-w-xs">{t.footer.tagline}</p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3">{t.footer.product}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/pricing" className="hover:text-foreground transition-colors">
                  {t.nav.pricing}
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-foreground transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-foreground transition-colors">
                  {t.nav.login}
                </Link>
              </li>
              <li>
                <Link to="/signup" className="hover:text-foreground transition-colors">
                  {t.nav.signup}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-3">{t.footer.company}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/about" className="hover:text-foreground transition-colors">
                  {t.footer.about}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors">
                  {t.footer.contact}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground transition-colors">
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-foreground transition-colors">
                  {t.footer.privacyPolicy}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/30 mt-8 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} TWIBO.id. {t.footer.allRights}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
