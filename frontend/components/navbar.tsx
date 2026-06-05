"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

export function Navbar() {
  const t = useTranslations();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg btn-amber flex items-center justify-center">
              <Zap className="w-4 h-4 text-black" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">
              Content<span className="text-gradient">Engineer</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("nav.signIn")}
            </Link>
            <a href="#signup">
              <button
                id="nav-cta-btn"
                className="btn-amber px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                {t("nav.getAccess")}
              </button>
            </a>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground transition"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border px-4 py-4 flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground py-2"
            onClick={() => setMenuOpen(false)}
          >
            {t("nav.signIn")}
          </Link>
          <a href="#signup" onClick={() => setMenuOpen(false)}>
            <button
              id="nav-cta-btn-mobile"
              className="btn-amber w-full py-3 rounded-lg text-sm font-bold"
            >
              {t("nav.getAccess")}
            </button>
          </a>
        </div>
      )}
    </nav>
  );
}
