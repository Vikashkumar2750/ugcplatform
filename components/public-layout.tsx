import Link from "next/link";
import { Zap, Mail, Instagram, Facebook } from "lucide-react";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg btn-amber flex items-center justify-center">
            <Zap className="w-4 h-4 text-black" />
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">
            Content<span className="text-gradient">IQ</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <Link href="/login" className="btn-amber px-4 py-1.5 rounded-lg text-xs font-bold text-black">
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-muted/20 mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg btn-amber flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-black" />
              </div>
              <span className="font-heading font-bold text-base">
                Content<span className="text-gradient">IQ</span>
              </span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI-powered social media automation & analytics platform by TechAasvik.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="mailto:contact@techaasvik.com" className="text-muted-foreground hover:text-amber-500 transition">
                <Mail className="w-4 h-4" />
              </a>
              <a href="https://instagram.com/techaasvik" target="_blank" rel="noopener" className="text-muted-foreground hover:text-amber-500 transition">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="https://facebook.com/techaasvik" target="_blank" rel="noopener" className="text-muted-foreground hover:text-amber-500 transition">
                <Facebook className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Legal</p>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/privacy", label: "Privacy Policy" },
                { href: "/terms", label: "Terms of Service" },
                { href: "/refund-policy", label: "Refund Policy" },
                { href: "/disclaimer", label: "Disclaimer" },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Company</p>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/about", label: "About Us" },
                { href: "/contact", label: "Contact Us" },
                { href: "/pricing", label: "Pricing" },
                { href: "/support", label: "Support" },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} TechAasvik. All rights reserved.</p>
          <p>
            Questions?{" "}
            <a href="mailto:contact@techaasvik.com" className="text-amber-500 hover:underline">
              contact@techaasvik.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
