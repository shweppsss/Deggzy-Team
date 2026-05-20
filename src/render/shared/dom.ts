// ============================================================================
// Render shared — minimal DOM utilities used by the renderers. Phase TS-13C.
//
// DELIBERATELY THIN. These are NOT a wrapper layer; they're the 3 helpers
// that the calendar grid mount + drag preview need. The rest stays as
// direct `document.*` calls — the migration doesn't add a DOM abstraction.
// ============================================================================

/** querySelectorAll on `root` (or document), returning a real Array. */
export function qsa<T extends Element = Element>(selector: string, root?: ParentNode): T[] {
  return Array.from((root || document).querySelectorAll<T>(selector));
}

/** Remove every element matching `selector` from the document. */
export function removeAll(selector: string): void {
  qsa(selector).forEach((el) => el.remove());
}

/** Toggle a class on every element matching `selector` (defaults to remove). */
export function removeClassAll(selector: string, className: string): void {
  qsa<HTMLElement>(selector).forEach((el) => el.classList.remove(className));
}
