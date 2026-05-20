// ============================================================================
// Todos widget — single row. Phase TS-14B. PURE HTML.
// ============================================================================

import type { TodoDeps, TodoEntity } from '../types';
import { dueInfo } from '../calculations';

export function buildTodoItem(t: TodoEntity, today: Date, deps: TodoDeps): string {
  const due = dueInfo(t, today, deps);
  const priority = deps.todoPriority(t);
  const subBits: string[] = [];
  if (t.cat) subBits.push(deps.escapeHtml(t.cat));
  if (due.label) subBits.push(due.label);
  const modifiers = [t.done ? 'is-done' : '', t.urgent ? 'is-urgent' : ''].filter(Boolean).join(' ');
  const trailBadge =
    !t.done && priority === 'critique' ? '<span class="list-row-badge is-critical" aria-label="Critique" title="Critique">⛔</span>' :
    !t.done && priority === 'urgent'   ? `<span class="list-row-badge is-urgent" aria-label="Urgent">${deps.icon('bolt', 11)}</span>` :
    '';
  const tagHtml = (Array.isArray(t.tags) && t.tags.length) ? ' ' + deps.tagChipsHTML(t.tags, { limit: 2 }) : '';
  return `
    <button type="button" class="list-row ${modifiers}" data-id="${t.id}" data-kind="todo" data-action="open" data-priority="${priority}" aria-label="${deps.escapeHtml(t.text)}">
      <span class="list-row-lead" data-action="toggle-todo" role="checkbox" aria-checked="${t.done ? 'true' : 'false'}" aria-label="Marquer comme ${t.done ? 'à faire' : 'fait'}">
        <span class="list-row-check">${t.done ? deps.icon('check', 14) : ''}</span>
      </span>
      <span class="list-row-body">
        <span class="list-row-title">${deps.escapeHtml(t.text)}${tagHtml}</span>
        <span class="list-row-sub ${due.cls}">${subBits.join('<span class="sep">·</span>')}</span>
      </span>
      <span class="list-row-trail">
        ${trailBadge}
        <span class="list-row-chev" aria-hidden="true">${deps.icon('chevron', 14)}</span>
      </span>
    </button>
  `;
}
