// ============================================================
// vn-scene-html.js — HTML generation for VisualNovelScene
// ============================================================

import { VNSceneState } from './vn-state.js';
import { VNAtmosphere } from './visual-effects/atmosphere/index.js';
import { FALLBACK_AVATAR } from './vn-id-utils.js';

class VNSceneHTML {
    constructor(scene, rowConfig) {
        this._scene = scene;
        this._rowConfig = rowConfig;
    }

    // ──────────────────────────────────────────────────────────
    // Row layout
    // ──────────────────────────────────────────────────────────

    computeRowLayout(count, position) {
        const cfg = this._rowConfig[position];
        if (!cfg?.enabled || count <= cfg.maxPerRow || cfg.maxRows <= 1) {
            return { rows: [count], useMultiRow: false };
        }

        const numRows = Math.min(cfg.maxRows, Math.ceil(count / cfg.maxPerRow));
        const rows = new Array(numRows).fill(0);
        let remaining = count;

        for (let r = numRows - 1; r >= 0; r--) {
            if (r === 0) { rows[r] = remaining; }
            else { const perRow = Math.ceil(remaining / (r + 1)); rows[r] = perRow; remaining -= perRow; }
        }
        return { rows, useMultiRow: rows.length > 1 };
    }

    sideCharacters(tokens, position, layout) {
        const { rows, useMultiRow } = layout || this.computeRowLayout(tokens.length, position);
        if (!useMultiRow || tokens.length <= 1) {
            return tokens.map(t => this.character(t)).join('');
        }

        let html = '', idx = 0;
        const totalRows = rows.length;
        for (let r = 0; r < totalRows; r++) {
            const rowTokens = tokens.slice(idx, idx + rows[r]);
            idx += rows[r];
            const isFront = r === totalRows - 1;
            let rowClass = 'vn-row';
            if (isFront) rowClass += ' vn-front-row';
            else if (totalRows === 2) rowClass += ' vn-back-row';
            else rowClass += ` vn-back-row vn-row-depth-${totalRows - 1 - r}`;
            const rowType = isFront ? 'front' : 'back';
            html += `<div class="${rowClass}" data-depth="${r}">${rowTokens.map(t => this.character(t, rowType)).join('')}</div>`;
        }
        return html;
    }

    // ──────────────────────────────────────────────────────────
    // Character
    // ──────────────────────────────────────────────────────────

    character(token, row = null) {
        const state = this._scene.state;
        const tokenId = token.id || `actor-${token.actor.id}`;
        const imgSrc = token.actor.img || token.document?.texture?.src || FALLBACK_AVATAR;
        const rowClass = row ? `vn-row-${row}` : '';
        const visibility = state.visibility?.[tokenId] ?? 'visible';
        const hiddenClass = visibility === 'hidden' ? 'vn-character-hidden'
                          : visibility === 'name-hidden' ? 'vn-character-name-hidden' : '';
        const displayName = (visibility !== 'visible') ? '???' : token.name;

        // Inline transform vars so element starts at correct values — prevents transition flash on insertion
        const charScale = state.portraitScales[tokenId];
        const charStyle = charScale !== undefined ? `--char-scale: ${charScale};` : '';
        const flipX = state.flipped[tokenId] ? '-1' : '1';

        return `<div class="vn-character ${rowClass} ${hiddenClass}" data-token-id="${tokenId}" data-name="${token.name}" style="${charStyle}">
            <img class="vn-character-img" src="${imgSrc}" alt="${token.name}" loading="lazy" style="--flip-x: ${flipX}">
            <div class="vn-character-nameplate"><span class="vn-nameplate-text">${displayName}</span></div>
            <div class="vn-character-glow"></div></div>`;
    }

    // ──────────────────────────────────────────────────────────
    // Full scene skeleton
    // ──────────────────────────────────────────────────────────

    scene(tokens) {
        const state = this._scene.state;
        const isGM = game.user.isGM;

        const sides = VNSceneState.POSITIONS.map(side => {
            const t = tokens[side] || [];
            const layout = this.computeRowLayout(t.length, side);
            return `<div class="vn-side vn-${side}-side ${t.length ? '' : 'empty'} ${layout.useMultiRow ? 'vn-multi-row' : ''}">${this.sideCharacters(t, side, layout)}</div>`;
        }).join('');

        const sizeButtons = isGM ? `
            <button type="button" class="vn-size-button" id="decrease-size" title="${game.i18n.localize('vn.toolbar.sizeDecrease')}"><i class="fas fa-minus"></i></button>
            <button type="button" class="vn-size-button vn-size-reset" id="reset-size" title="${game.i18n.localize('vn.toolbar.sizeReset')}">${Math.round(state.portraitScale * 100)}%</button>
            <button type="button" class="vn-size-button" id="increase-size" title="${game.i18n.localize('vn.toolbar.sizeIncrease')}"><i class="fas fa-plus"></i></button>
            <button type="button" class="vn-size-button" id="size-dialog" title="${game.i18n.localize('vn.toolbar.sizeSettings')}"><i class="fas fa-sliders-h"></i></button>
        ` : '';

        const mkHint = (k, d) => `<div class="vn-help-hint"><span class="vn-help-key">${k}</span><span>${d}</span></div>`;
        const helpHints = isGM
            ? mkHint(game.i18n.localize('vn.help.k_click'),      game.i18n.localize('vn.help.d_click'))
            + mkHint(game.i18n.localize('vn.help.k_ctrlClick'),  game.i18n.localize('vn.help.d_ctrlClick'))
            + mkHint(game.i18n.localize('vn.help.k_midClick'),   game.i18n.localize('vn.help.d_midClick'))
            + mkHint(game.i18n.localize('vn.help.k_rightClick'), game.i18n.localize('vn.help.d_rightClick'))
            + mkHint(game.i18n.localize('vn.help.k_altWheel'),   game.i18n.localize('vn.help.d_altWheel'))
            : mkHint(game.i18n.localize('vn.help.k_close'), game.i18n.localize('vn.help.d_close'))
            + mkHint(game.i18n.localize('vn.help.k_chat'),  game.i18n.localize('vn.help.d_chat'));

        const controls = `<div class="vn-size-controls">${sizeButtons}<div class="vn-help-wrap">
            <button type="button" class="vn-size-button" title="${game.i18n.localize('vn.help.btnTitle')}"><i class="fas fa-question"></i></button>
            <div class="vn-help-popup">
                <div class="vn-help-popup-title">${game.i18n.localize(isGM ? 'vn.help.titleGM' : 'vn.help.titlePlayer')}</div>
                ${helpHints}
            </div>
        </div></div>`;

        const atmoEffect = state.atmosphereEffect || 'particles';

        const pickerItems = VNAtmosphere.EFFECT_GROUPS.map(group =>
            `<div class="vn-atmo-group-header">${game.i18n.localize(group.label)}</div>`
            + group.effects.map(e => {
                const label = game.i18n.localize(VNAtmosphere.EFFECT_LABELS[e]);
                return `<button type="button" class="vn-atmo-item${e === atmoEffect ? ' active' : ''}" data-effect="${e}" title="${label}"><i class="fas ${VNAtmosphere.EFFECT_ICONS[e]}"></i><span>${label}</span></button>`;
            }).join('')
        ).join('');

        const btn = (cls, icon, title, label, unreadBadge = false) => `<button type="button" class="vn-toolbar-btn ${cls}" title="${title}"><i class="fas ${icon}"></i><span class="vn-toolbar-label">${label}</span>${unreadBadge ? '<span class="vn-chat-unread" hidden aria-live="polite">0</span>' : ''}</button>`;

        const toolbar = isGM
            ? `<div class="vn-toolbar">
                ${btn('vn-settings-button', 'fa-cog', game.i18n.localize('vn.toolbar.settings'), game.i18n.localize('vn.toolbar.settingsShort'))}
                <div class="vn-atmo-wrap">
                    ${btn('vn-atmosphere-cycle-btn', VNAtmosphere.EFFECT_ICONS[atmoEffect], game.i18n.format('vn.atmosphere.buttonTitle', { effect: game.i18n.localize(VNAtmosphere.EFFECT_LABELS[atmoEffect]) }), game.i18n.localize('vn.toolbar.atmosphereShort'))}
                    <div class="vn-atmosphere-picker" hidden>
                        <div class="vn-atmosphere-picker-header"><i class="fas fa-wand-sparkles"></i> ${game.i18n.localize('vn.atmosphere.header')}</div>
                        <div class="vn-atmosphere-picker-grid">${pickerItems}</div>
                    </div>
                </div>
                ${btn(`vn-particles-fg-btn${state.particlesForeground ? ' active' : ''}`, 'fa-layer-group', game.i18n.localize('vn.toolbar.particlesForeground'), game.i18n.localize('vn.toolbar.particlesShort'))}
                ${this._scene._generateSoundsWrapHTML()}
                ${btn('vn-minimize-all-button', 'fa-window-minimize', game.i18n.localize('vn.toolbar.minimizeAll'), game.i18n.localize('vn.toolbar.minimizeAllShort'))}
                ${btn('vn-minimize-self-button', 'fa-eye-slash', game.i18n.localize('vn.toolbar.minimizeSelf'), game.i18n.localize('vn.toolbar.minimizeSelfShort'))}
                ${btn('vn-epicrolls-button', 'fa-dice-d20', game.i18n.localize('vn.toolbar.epicRolls'), game.i18n.localize('vn.toolbar.epicRollsShort'))}
                <button type="button" class="vn-toolbar-btn vn-broadcast-button" title="${game.i18n.localize('vn.toolbar.broadcast')}" style="display:none"><i class="fas fa-broadcast-tower"></i><span class="vn-toolbar-label">${game.i18n.localize('vn.toolbar.broadcastShort')}</span></button>
                ${btn('vn-chat-button', 'fa-comments', game.i18n.localize('vn.toolbar.showChat'), game.i18n.localize('vn.toolbar.chatShort'), true)}
                ${btn('vn-close-button', 'fa-times', game.i18n.localize('vn.toolbar.closeScene'), game.i18n.localize('vn.toolbar.closeShort'))}
            </div>`
            : `<div class="vn-toolbar">
                ${btn('vn-chat-button', 'fa-comments', game.i18n.localize('vn.toolbar.showChat'), game.i18n.localize('vn.toolbar.chatShort'), true)}
                ${btn('vn-close-button', 'fa-times', game.i18n.localize('vn.toolbar.closePlayer'), game.i18n.localize('vn.toolbar.closeShort'))}
            </div>`;

        const maxBar = isGM ? `<div class="vn-maximized-actions">
            <button type="button" class="vn-toolbar-btn vn-maximize-all-button" title="${game.i18n.localize('vn.toolbar.maximizeAll')}"><i class="fas fa-window-maximize"></i></button>
            <button type="button" class="vn-toolbar-btn vn-maximize-self-button" title="${game.i18n.localize('vn.toolbar.maximizeSelf')}"><i class="fas fa-eye"></i></button>
        </div>` : '';

        return `<div id="vn-scene-overlay">
            <div class="vn-bg-layer"></div><div class="vn-background-overlay"></div>
            <div class="vn-fx-tint"></div><div class="vn-fx-rays"></div><div class="vn-fx-edges"></div><div class="vn-fx-scan"></div><div class="vn-fx-flash"></div>
            <div class="vn-vignette"></div><div class="vn-ambient-light"></div><div class="vn-particles"></div><div class="vn-ground-fog"></div>
            <div class="vn-fx-bloom"></div>
            ${controls}
            ${sides}<div class="vn-fx-grain"></div>${toolbar}
            <div class="vn-maximized-bar"><span class="vn-scene-title"><i class="fas fa-theater-masks"></i> ${game.i18n.localize('vn.scene.title')}</span>${maxBar}</div>
            <div class="vn-chat-panel" hidden>
                <div class="vn-chat-panel-header"><i class="fas fa-comments"></i> ${game.i18n.localize('vn.chat.header')}</div>
            </div>
        </div>`;
    }
}

export { VNSceneHTML };
