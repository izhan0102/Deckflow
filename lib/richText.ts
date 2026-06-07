/**
 * Tiny rich-text helpers used by the inline selection toolbar.
 *
 * The slide content fields (title, subtitle, body, bullets) used to be
 * plain text. They can now contain a small subset of inline HTML so the
 * floating selection toolbar can apply bold / italic / underline /
 * strikethrough / size / color formatting and have it persist.
 *
 * Allowed tags: <b>, <strong>, <i>, <em>, <u>, <s>, <strike>, <span>, <br>.
 * Allowed style props on <span>: font-weight, font-style,
 * text-decoration, font-size, color, background-color.
 *
 * Anything else is stripped on commit. Sanitization runs only on the
 * client (it walks the DOM); on the server we fall back to a plain-text
 * regex strip, which is safe because no server code consumes the inline
 * formatting — it only consumes the plain text via stripHtml().
 */

const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "s", "strike", "span", "br"]);
const ALLOWED_STYLES = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "font-size",
  "font-family",
  "color",
  "background-color",
  "text-align",
]);

/**
 * Strip every HTML tag and decode common entities, returning plain text.
 * Used for length measurement (layoutMath), PPTX export, and any place
 * that needs to read the underlying text content.
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[a-z\/][^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Length of the underlying plain text — used by layoutMath sizing. */
export function plainTextLength(html: string): number {
  return stripHtml(html).length;
}

/**
 * Walk the DOM and remove any tag or style property that's not on the
 * allow-list. Returns sanitized HTML.
 *
 * Client-only — uses the DOM. On the server we just strip everything and
 * return plain text wrapped in nothing.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof document === "undefined") {
    // SSR fallback: drop all formatting. Anyone reading on the server
    // only needs the plain text, anyway.
    return stripHtml(html);
  }

  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  walk(tpl.content);
  return tpl.innerHTML;
}

function walk(node: Node) {
  // Snapshot children — the array can mutate as we replace nodes.
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        // Replace the element with its text content. This preserves
        // user-typed text but drops the wrapping tag (e.g. <p>, <div>,
        // pasted markup we don't recognize).
        const replacement = document.createTextNode(el.textContent || "");
        el.parentNode?.replaceChild(replacement, el);
        continue;
      }

      // Drop every attribute except style.
      for (const attr of Array.from(el.attributes)) {
        if (attr.name !== "style") el.removeAttribute(attr.name);
      }

      // Filter style: keep only allow-listed properties.
      const styleDecl = el.style;
      const keep: Array<[string, string]> = [];
      for (let i = 0; i < styleDecl.length; i++) {
        const prop = styleDecl[i];
        if (ALLOWED_STYLES.has(prop)) {
          keep.push([prop, styleDecl.getPropertyValue(prop)]);
        }
      }
      if (keep.length === 0) {
        el.removeAttribute("style");
      } else {
        el.setAttribute("style", keep.map(([k, v]) => `${k}: ${v}`).join("; "));
      }

      // Remove an empty <span> with no useful style — collapses pointless
      // wrappers that some browsers leave behind after edits.
      if (tag === "span" && !el.getAttribute("style")) {
        const parent = el.parentNode;
        while (el.firstChild) parent?.insertBefore(el.firstChild, el);
        parent?.removeChild(el);
        continue;
      }

      walk(el);
    } else if (child.nodeType === Node.COMMENT_NODE) {
      child.parentNode?.removeChild(child);
    }
  }
}

/* ----------------------- whole-element formatting ------------------------ */

/**
 * Apply a single CSS style to the ENTIRE text of an html string by wrapping
 * it in one outer <span style="prop: value">. Re-applying replaces the same
 * property rather than nesting. Passing an empty value removes the property.
 * Used by the sidebar to format a whole text element at once (vs. the
 * floating toolbar which formats just the selection).
 */
export function applyWholeStyle(html: string, prop: string, value: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return html;
  const tpl = document.createElement("div");
  tpl.innerHTML = sanitizeRichHtml(html || "");

  // If the whole content is already a single wrapping span, edit it in place.
  const onlyChild = tpl.childNodes.length === 1 && tpl.firstChild?.nodeType === Node.ELEMENT_NODE
    ? (tpl.firstChild as HTMLElement)
    : null;
  const wrapper = onlyChild && onlyChild.tagName.toLowerCase() === "span" ? onlyChild : null;

  if (wrapper) {
    if (value) wrapper.style.setProperty(prop, value);
    else wrapper.style.removeProperty(prop);
    if (!wrapper.getAttribute("style")) {
      // No styles left — unwrap.
      const parent = wrapper.parentNode!;
      while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
      parent.removeChild(wrapper);
    }
    return sanitizeRichHtml(tpl.innerHTML);
  }

  // Otherwise wrap everything in a fresh span.
  const span = document.createElement("span");
  if (value) span.style.setProperty(prop, value);
  while (tpl.firstChild) span.appendChild(tpl.firstChild);
  tpl.appendChild(span);
  return sanitizeRichHtml(tpl.innerHTML);
}

/** Read a whole-element style value if the content is a single wrapping span. */
export function readWholeStyle(html: string, prop: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "";
  const tpl = document.createElement("div");
  tpl.innerHTML = sanitizeRichHtml(html || "");
  const onlyChild = tpl.childNodes.length === 1 && tpl.firstChild?.nodeType === Node.ELEMENT_NODE
    ? (tpl.firstChild as HTMLElement)
    : null;
  if (onlyChild && onlyChild.tagName.toLowerCase() === "span") {
    return onlyChild.style.getPropertyValue(prop) || "";
  }
  return "";
}
