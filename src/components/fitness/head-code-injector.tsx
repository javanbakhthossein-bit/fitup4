import { db } from "@/lib/db";
import React from "react";

/**
 * HeadCodeInjector — Server Component
 *
 * Fetches active HeadCode entries from the DB and renders them.
 *
 * For "head" placement:
 * - <meta> and <link> tags are extracted and rendered as real React elements
 *   (so they appear directly in <head> without any wrapper).
 * - <script> tags are extracted and rendered as real React <script> elements.
 * - Any remaining HTML is rendered via dangerouslySetInnerHTML on a hidden span.
 *
 * For body placements: everything is rendered inside a <div> wrapper.
 */

export async function HeadCodeInjector({
  placement,
}: {
  placement: "head" | "body_start" | "body_end";
}) {
  let codes: { code: string }[] = [];
  try {
    codes = await db.headCode.findMany({
      where: { isActive: true, placement },
      orderBy: [{ createdAt: "asc" }],
      select: { code: true },
    });
  } catch (e) {
    console.error("[HeadCodeInjector] DB error:", e);
    return null;
  }

  if (codes.length === 0) return null;

  const combined = codes.map((c) => c.code).join("\n");

  if (placement === "head") {
    // Parse the HTML to extract specific tags and render them as React elements.
    const elements: React.ReactElement[] = [];

    // Extract <meta> tags
    const metaRegex = /<meta\s+([^>]*)\/?>/gi;
    let match;
    let key = 0;
    while ((match = metaRegex.exec(combined)) !== null) {
      const attrs = match[1];
      const nameMatch = attrs.match(/name=["']([^"']+)["']/i);
      const contentMatch = attrs.match(/content=["']([^"']+)["']/i);
      const propertyMatch = attrs.match(/property=["']([^"']+)["']/i);
      const httpEquivMatch = attrs.match(/http-equiv=["']([^"']+)["']/i);
      const charsetMatch = attrs.match(/charset=["']([^"']+)["']/i);

      const metaProps: Record<string, string> = {};
      if (nameMatch) metaProps.name = nameMatch[1];
      if (contentMatch) metaProps.content = contentMatch[1];
      if (propertyMatch) metaProps.property = propertyMatch[1];
      if (httpEquivMatch) metaProps.httpEquiv = httpEquivMatch[1];
      if (charsetMatch) metaProps.charSet = charsetMatch[1];

      elements.push(React.createElement("meta", { key: `meta-${key++}`, ...metaProps }));
    }

    // Extract <link> tags
    const linkRegex = /<link\s+([^>]*)\/?>/gi;
    while ((match = linkRegex.exec(combined)) !== null) {
      const attrs = match[1];
      const relMatch = attrs.match(/rel=["']([^"']+)["']/i);
      const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
      const typeMatch = attrs.match(/type=["']([^"']+)["']/i);

      const linkProps: Record<string, string> = {};
      if (relMatch) linkProps.rel = relMatch[1];
      if (hrefMatch) linkProps.href = hrefMatch[1];
      if (typeMatch) linkProps.type = typeMatch[1];

      elements.push(React.createElement("link", { key: `link-${key++}`, ...linkProps }));
    }

    // Extract <script> tags
    const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    while ((match = scriptRegex.exec(combined)) !== null) {
      const attrs = match[1];
      const content = match[2];
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      const asyncMatch = attrs.match(/async/i);
      const typeMatch = attrs.match(/type=["']([^"']+)["']/i);

      const scriptProps: Record<string, any> = { key: `script-${key++}` };
      if (srcMatch) scriptProps.src = srcMatch[1];
      if (asyncMatch) scriptProps.async = true;
      if (typeMatch) scriptProps.type = typeMatch[1];

      if (srcMatch) {
        // External script
        // eslint-disable-next-line @next/next/no-sync-scripts
        elements.push(React.createElement("script", scriptProps));
      } else if (content && content.trim()) {
        // Inline script
        elements.push(React.createElement("script", { key: `script-${key++}`, dangerouslySetInnerHTML: { __html: content.trim() } }));
      }
    }

    // Remove all extracted tags from combined to get remaining HTML
    let remaining = combined
      .replace(metaRegex, "")
      .replace(linkRegex, "")
      .replace(scriptRegex, "")
      .trim();

    if (remaining) {
      elements.push(
        React.createElement("span", {
          key: `remaining-${key++}`,
          style: { display: "none" },
          dangerouslySetInnerHTML: { __html: remaining },
          suppressHydrationWarning: true,
        })
      );
    }

    return React.createElement(React.Fragment, null, ...elements);
  }

  // For body placements, a <div> wrapper is fine
  return React.createElement("div", {
    dangerouslySetInnerHTML: { __html: combined },
    suppressHydrationWarning: true,
  });
}
