"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect } from "react";
import Clarity from "@microsoft/clarity";

/**
 * ClientSideScripts — injects analytics scripts on the client side.
 * 
 * This bypasses CDN cache issues by initializing analytics via JavaScript
 * after the page loads, rather than relying on server-side rendering.
 */
function ClientSideScripts() {
  useEffect(() => {
    // Microsoft Clarity — initialized via official NPM package
    const projectId = "xi8940h5ty";
    Clarity.init(projectId);
  }, []);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ClientSideScripts />
      {children}
    </NextThemesProvider>
  );
}
