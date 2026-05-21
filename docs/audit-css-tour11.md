# Audit CSS — Tour 11 (Deggzy-Team)

**Date** : 2026-05-21
**Status** : source de vérité pour la phase 1 design system
**Remplace** : la section "dette CSS" du diagnostic tour 4

---

## 1. Résumé exécutif

L'audit du tour 4 prescrivait une "dette CSS = priorité #1" en parlant
de 6 376 lignes inline et ~95 mutations `.style.X`. L'audit détaillé
des tours 11a/11b nuance fortement ce diagnostic :

- Le système CSS du repo est **plus mature que prévu** : 83 custom
  properties organisées, 0 anti-pattern CSS-in-JS, glassmorphism
  Apple-style déjà câblé sur 62 occurrences.
- La vraie dette est **focale, pas systémique** : ~12–15 styles
  littéraux à extraire dans `/src/features/detail/render/*`, des valeurs
  hors-norme (couleurs, font-size, radius) à rationaliser, mais
  **aucune réécriture massive nécessaire**.
- La **vraie priorité bloquante reste H4** (innerHTML wipes destructifs,
  non auditée dans ce tour, sujet du tour 12+) — orthogonale à la dette
  CSS et indépendante.

**Conséquence sur la roadmap** : P1 (fondations) raccourcie de 5 → 3 tours.
P2 réordonnée pour attaquer H4 (innerHTML) avant la refonte par domaine.

---

## 2. Inventaire `index.html` (tour 11a)

### 2.1 Structure
- `index.html` : 14 332 lignes au total
- 1 seul bloc `<style>` : lignes 38–6 414 (6 377 lignes de CSS)
- 0 feuille CSS externe (`<link rel="stylesheet">`)
- 56 attributs `style="..."` inline dans le HTML statique

### 2.2 Selectors
- 1 002 selectors uniques, 1 196 occurrences (sélecteurs réutilisés)
- 1 047 classes / 10 IDs / 66 selectors d'éléments / 64 @-rules
- 228 occurrences de pseudo-classes/elements
- **Ratio classes:IDs = 105:1 — exceptionnellement sain**

### 2.3 Custom properties (variables CSS)
- 67 variables définies dans `:root` (système principal)
- 16 surcharges contextuelles via 8 sélecteurs
  (`.cal-week`, `.dash-release[data-state=…]`, `.tag-chip-more`)
- **Total : 83 noms de variables uniques en définition**
- Catégories : couleurs, glass (5 vars), radius (5), motion (8),
  typo (7), système Apple sys-* (9), divers (états, layout)

### 2.4 Top dette à rationaliser
- **Couleurs** : 36 hex différents + 60+ rgba uniques. 5 variantes de
  presque-noir (`#0a0a0a`, `#0a0a0c`, `#0E0E10`, `#08080A`, `#1A1A1C`)
  qui devraient toutes pointer sur `var(--bg)` ou `var(--bg-elev)`.
- **Font-size** : 33 valeurs uniques, dont 17 hors-norme avec demi-pixels
  (`8.5px`, `9.5px`, `10.5px`, `11.5px`, `12.5px`, `13.5px`, `14.5px`).
- **Border-radius** : `999px` (25×) et `100px` (8×) cohabitent pour des
  pills — devrait être unifié. 35 valeurs littérales `4px/6px/8px/12px/16px`
  contournent les `var(--radius-*)` (76 utilisations correctes).
- **!important** : 12 occurrences seulement (très bas, sain)
- **backdrop-filter** : 62 utilisations (système glass solide)

### 2.5 Typographie — choix tranchés
- Stack système Apple : `-apple-system, BlinkMacSystemFont,
  "SF Pro Display", "Segoe UI", system-ui, sans-serif`
- Déclarée 1 seule fois, héritée par 15 `inherit`
- **Décision** : SF Pro via stack système, pas de webfont
- Micro-arbitrage à venir : SF Pro Display vs Text (laisser shorthand
  Apple choisir par taille). Non bloquant.

---

## 3. Mutations CSS dans `/src/` (tour 11b)

### 3.1 Structure du code source
- 179 fichiers TS/TSX/JS, 14 882 LOC
- 22 sous-dossiers organisés en 2 paquets : `features/` (logique) +
  `render/` (rendu)

### 3.2 Mutations `.style.X = ...`
- **51 occurrences** (audit tour 4 estimait 95 — sur-évaluation 1.9×)
- **13 propriétés distinctes seulement** : toutes liées au calcul
  positionnel/dimensionnel runtime ou aux images user-uploaded
- **0 propriété visuelle statique** (pas de `color`, `padding`, `margin`,
  `font-size`, `border-radius` muté en JS)
- **Concentration** : 29/51 (57 %) dans 3 fichiers calendar drag/drop
  (week-drag.ts, month-drag.ts, drag-preview.ts) — **légitime**
- **14 fichiers concernés sur 179** (7.8 % du code)

### 3.3 Anti-patterns CSS-in-JS — vérification exhaustive
| Pattern | Occurrences | Verdict |
|---|---|---|
| `.style.setProperty()` | 0 | OK (vars définies en CSS, pas en JS) |
| `.style.cssText = ...` | 0 | Aucun bypass agressif |
| `setAttribute('style', ...)` | 0 | Aucun contournement API |
| `element.style = ...` (direct) | 0 | Aucune assignation directe |
| `<style>` en template string | 0 | Aucun CSS éparpillé en JS |

**4 anti-patterns standards. Zéro détecté. Exceptionnellement propre.**

### 3.4 Mutations classList (pattern sain)
- `classList.add` : 11
- `classList.remove` : 9
- `classList.toggle` : 4
- `.className = ...` : 4
- **Total : 28 mutations via API class**

### 3.5 Attributs `style="..."` dans templates
- **44 occurrences dans `/src/`**, principalement dans
  `src/features/detail/render/*`
- Décomposition estimée : ~30 légitimes (runtime-driven : images
  user-uploaded, couleurs derivées de data, dimensions calculées)
  + **~12–15 à extraire en classes** (valeurs littérales `margin-top:10px`,
  `font-size:13px`, `display:grid; grid-template-columns:2fr 1fr 1fr`...)

### 3.6 Animations DOM
- `requestAnimationFrame` : 4 (très peu)
- `.animate()` Web Animations API : 0 (aucune)
- `startViewTransition` : 1 fichier seulement (`mobile/transitions.ts`)
- **Confirmation** : capacité View Transitions câblée mais **non
  consommée** par l'UI (cohérent avec audit tour 4).

---

## 4. Cartographie par domaine

Distribution de la dette CSS par feature/render (triée par dette
inline `style="..."` décroissante) :

```
src/features/detail                         1291 LOC |  14 files |   9 .style.X |   3 classList |  22 style=
src/render/budget                            283 LOC |   9 files |   0 .style.X |   0 classList |   5 style=
src/render/dashboard                        1029 LOC |  13 files |   0 .style.X |   0 classList |   4 style=
src/render/inspirations                      305 LOC |   7 files |   0 .style.X |   2 classList |   3 style=
src/render/calendar                          969 LOC |   9 files |   9 .style.X |   6 classList |   2 style=
src/features/audio                          1659 LOC |  24 files |   2 .style.X |   0 classList |   1 style=
src/features/modals                          443 LOC |   6 files |   2 .style.X |   5 classList |   1 style=
src/render/todos                             430 LOC |   9 files |   1 .style.X |   0 classList |   1 style=
src/render/assets                            135 LOC |   6 files |   0 .style.X |   0 classList |   1 style=
src/render/catalogue                         142 LOC |   5 files |   0 .style.X |   0 classList |   1 style=
src/render/clips                             195 LOC |   6 files |   0 .style.X |   0 classList |   1 style=
src/render/plan                               47 LOC |   1 files |   0 .style.X |   0 classList |   1 style=
src/render/team                              154 LOC |   6 files |   0 .style.X |   0 classList |   1 style=
src/features/calendar                        672 LOC |   7 files |  22 .style.X |  11 classList |   0 style=
src/features/mini-player.ts                  189 LOC |   1 files |   4 .style.X |   0 classList |   0 style=
src/features/auth                           1175 LOC |   9 files |   1 .style.X |   0 classList |   0 style=
src/render/profile                           110 LOC |   1 files |   1 .style.X |   0 classList |   0 style=
src/features/analytics                       230 LOC |   4 files |   0 .style.X |   0 classList |   0 style=
src/features/mobile                          284 LOC |   5 files |   0 .style.X |   0 classList |   0 style=
src/features/offline                         315 LOC |   5 files |   0 .style.X |   0 classList |   0 style=
src/features/realtime                        375 LOC |   5 files |   0 .style.X |   0 classList |   0 style=
src/features/tracks                          388 LOC |   5 files |   0 .style.X |   0 classList |   0 style=
src/render/capsules                           39 LOC |   1 files |   0 .style.X |   0 classList |   0 style=
src/render/kpi                                39 LOC |   1 files |   0 .style.X |   0 classList |   0 style=
src/render/shared                            133 LOC |   4 files |   0 .style.X |   1 classList |   0 style=
src/render/types.ts                           51 LOC |   1 files |   0 .style.X |   0 classList |   0 style=
src/render/dispatch.ts                       245 LOC |   1 files |   0 .style.X |   0 classList |   0 style=
src/render/index.ts                           34 LOC |   1 files |   0 .style.X |   0 classList |   0 style=
```

---

## 5. Inventaire complet des 44 `style="..."` dans `/src/`

```
src/features/modals/inspi-modal.ts:46:    inner = `<div class="inspi-preview-embed" style="aspect-ratio:${aspect};">${d.mediaEmbed}</div>`;
src/features/detail/event-actor.ts:54:  return `<span class="${cls}" data-actor-id="${actorId}" style="background:${color}" title="${title}">${escapeHtml(initial)}</span>`;
src/features/detail/render/todo.ts:33:      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;">
src/features/detail/render/track.ts:48:      `<div class="track-audio-meta" data-meta-for="${deps.escapeHtml(t.id)}" style="margin-top:10px;"></div>` +
src/features/detail/render/track.ts:49:      `<div class="track-audio-actions" data-actions-for="${deps.escapeHtml(t.id)}" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;"></div>`
src/features/detail/render/track.ts:52:  return `<label class="detail-audio-empty">+ Charger l'audio (WAV / MP3 / FLAC)<input type="file" accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg" style="display:none;" onchange="handleDetailAudio('${t.id}', event)" /></label>`;
src/features/detail/render/track.ts:70:      <label class="track-hero-cover ${hasCover ? 'has-image' : ''}" data-cover-for-detail="${t.id}" style="${coverInline ? `background-image:url('${coverInline}')` : ''}">
src/features/detail/render/track.ts:72:        <input type="file" accept="image/*" style="display:none;" onchange="handleDetailCover('${t.id}', event)" />
src/features/detail/render/track.ts:127:      ` : `<div style="font-size: 13px; color: var(--text-soft); margin-bottom: 10px;">Aucun événement pour l'instant.</div>`}
src/features/detail/render/track.ts:128:      <button class="btn" style="margin-top: 10px;" onclick="addEventForTrack('${t.id}')">+ Ajouter</button>
src/features/detail/render/track.ts:133:      <div class="info-list" style="margin: 12px 0 0;">
src/features/detail/render/inspi.ts:25:      media = `<video src="${i.data}" controls style="width:100%; max-height:500px; background:#000; border-radius:var(--radius);"></video>`;
src/features/detail/render/inspi.ts:27:      media = `<img src="${i.data}" style="width:100%; max-height:500px; object-fit:contain; background:#000; border-radius:var(--radius);" />`;
src/features/detail/render/inspi.ts:30:    media = `<div style="padding:60px; background: var(--surface); border-radius:var(--radius); text-align:center; font-size:48px; color:#7AB5C9;">↗</div>`;
src/features/detail/render/inspi.ts:32:    media = `<div style="padding:80px 40px; background: var(--accent-soft); border-radius:var(--radius); text-align:center; font-size:36px; font-weight:800; color: var(--accent);">"${esc(i.title)}"</div>`;
src/features/detail/render/inspi.ts:41:    <div class="detail-section" style="margin-top:24px;">
src/features/detail/render/inspi.ts:43:      <textarea style="width:100%; min-height: 120px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; color: var(--text); font-family: inherit; font-size: 14px; line-height: 1.5;" placeholder="À remplir..." onblur="updateInspiField('${i.id}','notes',this.value)">${esc(i.notes || '')}</textarea>
src/features/detail/render/inspi.ts:45:        <div class="detail-field" style="margin-top:14px;"><label>URL</label><input value="${esc(i.url || '')}" onchange="updateInspiField('${i.id}','url',this.value)" /></div>
src/features/detail/render/inspi.ts:47:      ${i.url ? `<div style="margin-top:14px;"><a href="${i.url}" target="_blank" rel="noopener" style="color:#7AB5C9; word-break:break-all;">${esc(i.url)} ↗</a></div>` : ''}
src/features/detail/render/event.ts:73:      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 14px;">
src/features/detail/render/event.ts:114:        ${deps.suggestChecklist(e.type).map((c) => `<div style="display:flex; gap:10px; align-items:center; font-size:13px; color: var(--text-soft);"><span style="width:6px; height:6px; background: var(--accent); border-radius:50%;"></span>${c}</div>`).join('')}
src/features/detail/render/phase.ts:34:      <ul style="padding-left:18px; color: var(--text-soft); font-size: 14px; line-height: 1.8;">
src/features/detail/hydrate.ts:74:      <label class="btn btn-sm" style="cursor:pointer;">Remplacer<input type="file" accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg" style="display:none;" onchange="handleDetailAudio('${trackId}', event)" /></label>
src/features/audio/pill/html.ts:52:      <div class="track-audio-progress"><div class="track-audio-progress-fill" style="width:${fillPct.toFixed(2)}%"></div></div>
src/render/calendar/week.ts:111:        html += `<div class="cal-week-now-line" style="top:${offset}px;"></div>`;
src/render/calendar/event-chip.ts:77:                  style="top:${geom.top + 2}px; height:${geom.height}px;"${tip ? ` title="${escapeHtml(tip)}"` : ''}>
src/render/clips/widgets/video-card.ts:24:          <button class="btn btn-sm" onclick="event.stopPropagation(); deleteVideo('${kind}', '${safeId}')" aria-label="Supprimer" style="margin-left:auto;">×</button>
src/render/plan/index.ts:29:      ? `<li style="opacity:.6;">+ ${items.length - 3} de plus → cliquer</li>`
src/render/dashboard/widgets/hero.ts:31:      <span style="color:var(--text-dim);">${deps.icon('chevron', 16)}</span>
src/render/dashboard/widgets/urgent.ts:36:              <div class="todo-checkbox" style="border-color: ${borderColor};" onclick="event.stopPropagation(); toggleTodo('${t.id}')"></div>
src/render/dashboard/widgets/today.ts:15:  '<div style="padding: 28px 12px; text-align: left; color: var(--text-soft); font: var(--font-body); letter-spacing: var(--tracking-body);">' +
src/render/dashboard/widgets/upcoming.ts:50:              ${metaParts.length ? `<div class="dash-upcoming-meta">${metaParts.join('<span style="opacity:.4;">·</span>')}</div>` : ''}
src/render/team/widgets/member-row.ts:16:              <span class="list-row-lead"${isPending ? ' style="opacity:0.45"' : ''}>${memberInitials(m)}</span>
src/render/todos/widgets/filter-chips.ts:15:    return `<div class="todo-filter-chip ${activeFilter === f ? 'active' : ''}" onclick="setTodoFilter('${f}')">${label} <span style="opacity:.6">· ${count}</span></div>`;
src/render/catalogue/widgets/track-card.ts:18:      <label class="track-cover ${hasCover ? 'has-image' : ''}" data-cover-for="${t.id}" onclick="event.stopPropagation()" style="${coverInline ? `background-image:url('${coverInline}')` : ''}">
src/render/inspirations/widgets/card.ts:26:    mediaBlock = `<div class="inspi-card-media inspi-card-media-embed" style="aspect-ratio:${aspect};">${it._mediaEmbed}</div>`;
src/render/inspirations/widgets/card.ts:28:    mediaBlock = `<div class="inspi-card-media inspi-card-media-link" style="aspect-ratio:9/16; background: linear-gradient(135deg, #25F4EE, #FE2C55);"><div class="inspi-card-link-glyph">${deps.icon('music', 32)}</div></div>`;
src/render/inspirations/widgets/filter-chips.ts:13:    return `<div class="todo-filter-chip ${activeFilter === f ? 'active' : ''}" onclick="setInspiFilter('${deps.escapeHtml(f)}')">${deps.escapeHtml(label)} <span style="opacity:.6">· ${count}</span></div>`;
src/render/assets/widgets/tile.ts:19:    <div class="asset-tile" style="background-image: url('${item.data}')">
src/render/budget/widgets/hero.ts:21:    <div class="budget-bar"><div class="budget-bar-fill ${t.spent > t.total ? 'over' : ''}" style="width: ${t.pct}%"></div></div>
src/render/budget/widgets/splits.ts:10:  const intro = `<div style="font-size: 12px; color: var(--text-soft); margin-bottom: 12px;">Définis qui touche quoi sur chaque morceau. Ajoute autant de contributeurs que tu veux (manager, investisseur, beatmaker, topliner...). Le total doit faire <strong>100 %</strong> pour chaque morceau.</div>`;
src/render/budget/widgets/categories.ts:21:        <div class="budget-cat-bar"><div class="budget-cat-bar-fill" style="width:${p}%"></div></div>
src/render/budget/widgets/transactions.ts:10:    <div>Date</div><div>Libellé</div><div class="tx-item-cat-col">Catégorie</div><div style="text-align:right;">Montant</div><div></div>
src/render/budget/widgets/transactions.ts:13:    return html + '<div class="empty" style="border:none;">Aucune dépense. Clique sur + Dépense pour ajouter.</div>';
```

---

## 6. Décisions actées au tour 11

1. **Fonte** : SF Pro via stack système Apple. Item retiré des open
   items. Micro-arbitrage Display vs Text reporté à la phase design
   system.
2. **Accent color** : la variable `--accent-rgb` existe (utilisée 28×).
   Décision restante = uniquement choisir la valeur `r,g,b`. Item
   reformulé.
3. **Système de variables CSS** : déjà solide, à **respecter** plutôt
   qu'à reconstruire.
4. **Roadmap P1** : raccourcie de 5 → 3 tours.
5. **Roadmap P2** : H4 (innerHTML) attaqué en premier, avant refonte
   par domaine.

---

## 7. Open items issus de l'audit

### À trancher avant phase 1
- [ ] Choisir la valeur `r,g,b` pour `--accent-rgb`
- [ ] Confirmer la stratégie de rationalisation valeurs hors-norme
      (script sed automatisé vs PRs manuelles par domaine)

### À planifier en phase 1 (3 tours estimés)
- [ ] Extraction des 12–15 styles littéraux dans `/src/features/detail/render/*`
      vers des classes CSS nommées
- [ ] Substitution des 36 hex de couleur → variables `var(--bg/surface/...)`
- [ ] Substitution des 17 font-size hors-norme → variables `var(--font-*)`
- [ ] Unification `border-radius: 999px` / `100px` → `var(--radius-pill)`
      (à créer si pas déjà couvert)

### À planifier en phase 2 (priorité revue : H4 en premier)
- [ ] Audit détaillé des 58 `innerHTML =` destructifs (dette H4)
- [ ] Stratégie patch-DOM léger ou alternative
- [ ] Activation View Transitions API sur les premiers domaines

### Long terme (intention enregistrée tour 10)
- [ ] Migration zéro-HTML : élimination progressive du HTML statique au
      profit de DOM généré programmatiquement par les modules TS
