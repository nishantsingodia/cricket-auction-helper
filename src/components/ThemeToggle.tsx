"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  // Light is the default; the pre-paint script in layout.tsx has already applied a stored
  // 'dark' choice to <html> by the time this mounts, so read the class rather than assuming.
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={toggle}
      className="w-10 h-10 flex items-center justify-center md:block md:w-auto md:h-auto px-2 py-1.5 rounded-md border border-border text-sm hover:bg-muted transition-colors"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? "\u2600\uFE0F" : "\uD83C\uDF19"}
    </button>
  );
}
