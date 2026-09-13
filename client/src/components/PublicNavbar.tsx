import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Logo } from "./Logo";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";

interface PublicNavbarProps {
  onGoToLogin: () => void;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({ onGoToLogin }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMobileMenuOpen &&
        headerRef.current &&
        !headerRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileMenuOpen]);

  // Close menu if user actively scrolls (using touch or wheel)
  // We use touchmove/wheel instead of 'scroll' because expanding the sticky
  // header triggers browser scroll-anchoring which fires false scroll events.
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleUserScroll = () => {
      setIsMobileMenuOpen(false);
    };

    // Use passive listeners for better performance
    window.addEventListener("touchmove", handleUserScroll, { passive: true });
    window.addEventListener("wheel", handleUserScroll, { passive: true });

    return () => {
      window.removeEventListener("touchmove", handleUserScroll);
      window.removeEventListener("wheel", handleUserScroll);
    };
  }, [isMobileMenuOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const navItemClass = (path: string) =>
    `inline-flex items-center justify-center rounded-xl h-10 px-3 lg:px-4 font-semibold transition-all text-sm whitespace-nowrap ${
      isActive(path)
        ? "text-brand bg-brand/5 hover:bg-brand/10"
        : "text-textSecondary hover:text-textPrimary hover:bg-hoverSoft"
    }`;

  const mobileNavItemClass = (path: string) =>
    `inline-flex items-center justify-start rounded-xl h-12 px-4 font-semibold transition-all text-base w-full ${
      isActive(path)
        ? "text-brand bg-brand/5 hover:bg-brand/10"
        : "text-textSecondary hover:text-textPrimary hover:bg-hoverSoft"
    }`;

  return (
    <header
      ref={headerRef}
      className="sticky top-0 w-full z-30 bg-bgMain/80 backdrop-blur-xl border-b border-borderSoft/40 pt-safe"
    >
      <div className="flex items-center justify-between h-16 sm:h-[4.5rem] px-4 sm:px-6 lg:px-8 3xl:px-12 w-full max-w-[1440px] 3xl:max-w-[1800px] 4k:max-w-[2400px] uhd:max-w-[3200px] mx-auto gap-2">
        {/* Left: Logo & Nav Links */}
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 min-w-0">
          <div className="shrink-0">
            <Logo size="md" />
          </div>

          {/* Desktop Nav Links (lg and up, so tablets get the hamburger) */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center gap-1 xl:gap-2"
          >
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className={navItemClass("/")}
            >
              Home
            </Link>
            <Link
              to="/about-sbg"
              onClick={() => setIsMobileMenuOpen(false)}
              className={navItemClass("/about-sbg")}
            >
              About SBG
            </Link>
            <Link
              to="/clubs-committees"
              onClick={() => setIsMobileMenuOpen(false)}
              className={navItemClass("/clubs-committees")}
            >
              Clubs & Committees
            </Link>
          </nav>
        </div>

        {/* Right: Utilities */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 shrink-0">
          <ThemeToggle className="h-11 w-11 lg:h-10 lg:w-10 rounded-xl" iconClassName="h-5 w-5 lg:h-4 lg:w-4" />

          {/* Sign In (Desktop Only) */}
          <Button
            onClick={onGoToLogin}
            className="hidden lg:inline-flex rounded-xl h-10 px-4 xl:px-6 font-bold bg-gradient-button text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all items-center gap-1.5 text-sm whitespace-nowrap"
          >
            <span>Sign In</span>
            <ArrowRight size={14} />
          </Button>

          {/* Mobile / Tablet Hamburger Button (below lg) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="lg:hidden rounded-xl border border-borderSoft/40 bg-hoverSoft/20 text-textPrimary hover:bg-hoverSoft/40 transition-all h-11 w-11 shrink-0 flex items-center justify-center"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="lg:hidden border-t border-borderSoft/40 bg-bgMain/95 backdrop-blur-xl overflow-hidden"
          >
            <nav
              aria-label="Mobile navigation"
              className="flex flex-col gap-1.5 p-3 sm:p-4 max-w-7xl mx-auto pb-safe"
            >
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/")}
              >
                Home
              </Link>
              <Link
                to="/about-sbg"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/about-sbg")}
              >
                About SBG
              </Link>
              <Link
                to="/clubs-committees"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileNavItemClass("/clubs-committees")}
              >
                Clubs & Committees
              </Link>
              <Button
                onClick={() => {
                  onGoToLogin();
                  setIsMobileMenuOpen(false);
                }}
                className="justify-start rounded-xl h-12 px-4 font-bold bg-gradient-button text-white shadow-md gap-2 w-full text-base mt-1"
              >
                <span>Sign In</span>
                <ArrowRight size={16} />
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
