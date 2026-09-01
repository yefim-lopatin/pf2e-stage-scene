import { Socket } from "../lib/socket.js";
import { MODULE_ID } from "../main.js";
import { getSetting } from "../settings.js";
import { HandlebarsApplication, mergeClone } from "../lib/utils.js";

export class EpicRoll extends HandlebarsApplication {
    constructor(rollData) {
        super();
        this.rollData = rollData;
        this._resolve;
        this._reject;
        this.promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    init() {
        const recovered = this.rollData.recovered;
        this.prepareData();
        ui.PF2eStageEpicRolls._currentRoll = this;
        this._results = {};
        this._rolls = {};
        this._messageIds = new Set();
        if (recovered) {
            this._recovered = true;
            this._results = recovered.results;
            this._rolls = recovered.rolls;
            this._messageIds = new Set(recovered.messageIds);
        }
        return this;
    }

    static get APP_ID() {
        return this.name
            .split(/(?=[A-Z])/)
            .join("-")
            .toLowerCase();
    }

    get APP_ID() {
        return this.constructor.APP_ID;
    }

    static get DEFAULT_OPTIONS() {
      return mergeClone(super.DEFAULT_OPTIONS, {
        classes: ["epic-roll-5e"],
        window: {
          frame: false,
          positioned: false,
        },
      });
    }

    prepareData() {
        this.actors = this.rollData.actors.map((actor) => fromUuidSync(actor)).filter(Boolean);
        this.contestants = this.rollData.contestants.map((actor) => fromUuidSync(actor)).filter(Boolean);
        this.rollOptions = this.rollData.options;
        this.rollOptions.showDC = this.rollOptions.showDC || game.user.isGM;
        this.rollOptions.hideNames = this.rollOptions.hideNames;
        this.type = this.rollData.type;
        this.contest = this.rollData.contest;
        const autoColor = this.rollOptions.autoColor ? this.getAutoColor() : null;
        const color = autoColor ?? this.rollOptions.color ?? 0;
        document.documentElement.style.setProperty("--epic-rolls-banner-hue", `${color}deg`);
    }

    getAutoColor() {
        const [type] = this.rollData.type.split(".");
        return ROLL_COLORS[type] ?? 0;
    }

    async _prepareContext(options) {
        const showDC = this.rollOptions.showDC || game.user.isGM;
        const introLabel = EpicRoll.getRollLabel(this.rollData.type, showDC ? this.rollData.options.DC : null, this.rollData.contest, this.rollData.options);
        this._introLabel = introLabel;
        return { introLabel, actors: this.actors, contestants: this.contestants, options: this.rollOptions, isGM: game.user.isGM };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;
        this.executeIntroAnimation(html);
        html.querySelectorAll("span.adv, span.dis").forEach((span) => {
            span.addEventListener("click", this._onClickAdvDis.bind(this));
        });
        html.querySelectorAll(".roll").forEach((roll) => {
            roll.addEventListener("click", this.roll.bind(this));
        });
        if (this.rollOptions.allowReroll || game.user.isGM) {
            html.querySelectorAll(".result").forEach((roll) => {
                roll.addEventListener("click", this.roll.bind(this));
            });
        }
        html.querySelector(".end-epic-roll").addEventListener("click", () => {
            Socket.endEpicRoll({ abort: true });
        });
        html.querySelector(".end-epic-roll-manual").addEventListener("click", (e) => {
            e.preventDefault();
            Socket.endEpicRoll({ button: true });
            e.currentTarget.classList.add("er5e-hidden-2");
        });
        this.recoverState();
        this.setAdvDis();
    }

    setAdvDis() {
        const rollSettings = this.rollOptions.rollSettings;
        if (!rollSettings?.length) return;
        for (const rollSetting of rollSettings) {
            const uuid = rollSetting.uuid;
            const actorCard = this.element.querySelector(`.actor-card[data-uuid="${uuid}"]`);
            if (!actorCard) continue;
            const rollBadge = actorCard.querySelector(".roll-badge");
            if (!rollBadge) continue;
            const adv = rollBadge.querySelector("span.adv");
            const dis = rollBadge.querySelector("span.dis");
            if (rollSetting.advantage) adv.classList.add("active");
            if (rollSetting.disadvantage) dis.classList.add("active");
            if (rollSetting.autoRoll && game.users.activeGM === game.user) {
                setTimeout(() => {
                    this.roll({ currentTarget: actorCard.querySelector(".roll") });
                }, 1000);
            }
        }
    }

    _onClickAdvDis(e) {
        const span = e.currentTarget;
        const other = Array.from(span.closest(".roll-badge").querySelectorAll("span.adv, span.dis")).find((s) => s !== span);
        if (other.classList.contains("active")) {
            other.classList.remove("active");
        }
        span.classList.toggle("active");
    }

    async executeIntroAnimation(html) {
        const soundPath = getSetting("introSound");
        if (soundPath) {
            foundry.audio.AudioHelper.play({ src: soundPath, volume: 0.8, autoplay: true, loop: false }, false);
        }

        const introText = html.querySelector(".intro-text");
        //remove it when the animation is done
        const introTextPromise = new Promise((resolve) => {
            introText.addEventListener("animationend", () => {
                introText.remove();
                resolve();
            });
        });
        await introTextPromise;
        //unhide actor cards
        const actorCardsContainer = html.querySelector(".actor-cards");
        actorCardsContainer.classList.remove("er5e-hidden");
        //set transform translate to 0 on actor cards in sequence
        const actorCards = actorCardsContainer.querySelectorAll(".actor-card");
        //animate the cards from transform translate -100vw to 0
        const cardCount = actorCards.length;
        actorCards.forEach((card, index) => {
            card.animate([{ transform: `translateX(-${100 * (index + 1)}vw)` }, { transform: "translateX(0)" }], {
                duration: 700,
                easing: "ease-in-out",
                fill: "forwards",
                delay: (cardCount - index) * 150,
            });
        });
    }

    async executeOutroAnimation(html, isSuccess) {
        const soundPath = isSuccess ? getSetting("successSound") : getSetting("failureSound");

        //wait 2 seconds before starting the outro animation
        await EpicRoll.wait(2000);
        const actorCardsContainer = html.querySelector(".actor-cards");
        const actorCards = actorCardsContainer.querySelectorAll(".actor-card");
        //animate the cards from transform translate 0 to -100vw
        const cardCount = actorCards.length;
        actorCards.forEach((card, index) => {
            card.animate([{ transform: "translateX(0)" }, { transform: `translateX(100vw)` }], {
                duration: 500,
                easing: "ease-in-out",
                fill: "forwards",
                delay: (cardCount - index) * 100,
            });
        });
        //wait for all animations to finish
        await EpicRoll.wait(500 + cardCount * 100);
        actorCardsContainer.remove();

        //display end text
        if (this.rollOptions.showRollResults && isSuccess !== undefined) {
            const outroText = html.querySelector(".outro-text");
            outroText.textContent = game.i18n.localize(`${MODULE_ID}.epicRolls.${isSuccess ? "success" : "failure"}`) + "!";
            outroText.classList.remove("er5e-hidden");
            //play fade in animation on outro text
            outroText.animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: 300,
                easing: "ease-in-out",
                fill: "forwards",
            });
            if (soundPath) foundry.audio.AudioHelper.play({ src: soundPath, volume: 0.8, autoplay: true, loop: false }, false);
            await EpicRoll.wait(3000);
        }
        //fade out the html
        html.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 500,
            easing: "ease-in-out",
            fill: "forwards",
        });
        await EpicRoll.wait(500);
        await this.close();
        return true;
    }

    async roll(e) {
        const rollButton = e.currentTarget;
        const uuid = rollButton.closest(".actor-card").dataset.uuid;
        const adv = rollButton.closest(".roll-badge").querySelector("span.adv").classList.contains("active");
        const dis = rollButton.closest(".roll-badge").querySelector("span.dis").classList.contains("active");
        Socket.toggleRollButton({ uuid, rolling: true });
        const ff = adv || dis || !e.shiftKey;
        if (ff) e = null;
        const actor = fromUuidSync(uuid);
        const isContestant = this.contestants.some((c) => c.uuid === uuid);
        const rollType = isContestant ? this.contest : this.type;
        const [type, key] = rollType.split(".");
        const isBlind = this.rollOptions.blindRoll;
        const rollOptions = {
            event: e,
            createMessage: false,
            messageMode: isBlind ? "blind" : "publicroll",
            rollTwice: adv ? "keep-higher" : dis ? "keep-lower" : false,
            skipDialog: ff,
        };

        let result;

        if (type === "skill") {
            result = await actor.skills?.[key]?.check.roll(rollOptions);
        } else if (type === "save") {
            result = await actor.saves?.[key]?.check.roll(rollOptions);
        } else if (type === "perception") {
            result = await actor.perception?.check.roll(rollOptions);
        } else if (type === "custom") {
            const roll = new Roll(this.rollOptions.formula, actor.system);
            result = await roll.roll();
        } else if (type === "initiative") {
            result = await actor.initiative?.roll({ ...rollOptions, type: "initiative" });
        }

        if (!result) {
            Socket.toggleRollButton({ uuid, rolling: false });
            return;
        }

        result = Array.isArray(result) ? result[0] : result;

        const value = Math.round(result.total);

        const message = await result.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) }, { messageMode: isBlind ? "blind" : "public" });

        if (!isBlind) await this.waitForMessageRender(message?.id);

        Socket.toggleRollButton({ uuid, rolling: false });

        Socket.updateEpicRoll({
            uuid,
            value,
            isCritical: result.options?.degreeOfSuccess === 3,
            isFumble: result.options?.degreeOfSuccess === 0,
            rollData: result,
            messageId: message?.id,
        });
    }

    async waitForMessageRender(messageId) {
        if (!messageId) return true;

        const timeoutMs = 5000;
        const pollInterval = 50;
        let elapsed = 0;

        return new Promise((resolve) => {
            const check = () => {
                const msgEl = document.querySelector(`.chat-log .message[data-message-id="${messageId}"]`);
                if (
                    msgEl &&
                    msgEl.offsetParent !== null &&
                    window.getComputedStyle(msgEl).display !== "none" &&
                    window.getComputedStyle(msgEl).visibility !== "hidden" &&
                    msgEl.offsetWidth > 0 &&
                    msgEl.offsetHeight > 0
                ) {
                    resolve(true);
                } else if (elapsed >= timeoutMs) {
                    console.warn("Epic Rolls: waitForMessageRender timed out for message ID:", messageId);
                    resolve(true);
                } else {
                    elapsed += pollInterval;
                    setTimeout(check, pollInterval);
                }
            };
            check();
        });
    }

    toggleRollButton(uuid, rolling = false) {
        const actorCard = this.element.querySelector(`.actor-card[data-uuid="${uuid}"]`);
        const rollButton = actorCard.querySelector(".roll");
        rollButton.style.pointerEvents = rolling ? "none" : "auto";
        rollButton.classList.toggle("fa-shake", rolling);
    }

    recoverState() {
        if (!this._recovered) return;
        for (const [uuid, value] of Object.entries(this._results)) {
            const actorCard = this.element.querySelector(`.actor-card[data-uuid="${uuid}"]`);
            const data = this._rolls[uuid];
            const resultEl = actorCard.querySelector(".result");
            const hideResult = this.rollOptions.blindRoll && !game.user.isGM;
            resultEl.textContent = hideResult ? "?" : value;
            resultEl.classList.remove("er5e-hidden");
            if (data.isCritical && !hideResult) resultEl.classList.add("critical");
            if (data.isFumble && !hideResult) resultEl.classList.add("fumble");
            actorCard.querySelector(".roll").classList.add("er5e-hidden");
            if (this.rollOptions.blindRoll) resultEl.classList.add("blind");
        }
        delete this._recovered;
    }

    update(data) {
        this._results[data.uuid] = data.value;
        this._rolls[data.uuid] = data.rollData;
        if (data.messageId) this._messageIds.add(data.messageId);
        const actorCard = this.element.querySelector(`.actor-card[data-uuid="${data.uuid}"]`);
        const resultEl = actorCard.querySelector(".result");
        resultEl.textContent = this.rollOptions.blindRoll && !game.user.isGM ? "?" : data.value;
        resultEl.classList.remove("er5e-hidden");
        actorCard.querySelector(".roll").classList.add("er5e-hidden");
        if (data.isCritical) resultEl.classList.add("critical");
        if (data.isFumble) resultEl.classList.add("fumble");
        if (this.rollOptions.blindRoll) resultEl.classList.add("blind");
        //play animation on actor card, scale up then slowly scale back to normal
        actorCard.animate([{ transform: "scale(1.0)" }, { transform: "scale(1.1)" }, { transform: "scale(1.0)" }], {
            duration: 500,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
        });
        //check if all results are in
        const allActors = this.actors.concat(this.contestants);
        const allResults = allActors.every((actor) => Number.isNumeric(this._results[actor.uuid]));
        if (allResults) {
            Socket.endEpicRoll({ abort: false });
        }
    }

    async endEpicRoll({ abort, button }) {
        if (this._ending) return;
        this._ending = true;
        if (abort) {
            this.resolveRoll(abort);
            return this.close();
        }
        const allowReroll = this.rollOptions.allowReroll;
        if (!button && allowReroll) {
            if (game.user.isGM) this.element.querySelector(".end-epic-roll-manual").classList.remove("er5e-hidden-2");
            this._ending = false;
            return;
        }
        const isSuccess = this.computeSuccess();
        this.resolveRoll(abort, isSuccess);
        this.computeInitiative();
        await this.executeOutroAnimation(this.element, isSuccess);
    }

    async computeInitiative() {
        const isInitiative = this.type === "initiative.initiative";
        if (!isInitiative || !this.rollOptions.useAverage) return;
        const playerOwned = this.actors.filter((a) => a.hasPlayerOwner).map((a) => a.token?.document ?? a.getActiveTokens()[0]);
        const nonPlayerOwned = this.actors.filter((a) => !a.hasPlayerOwner).map((a) => a.token?.document ?? a.getActiveTokens()[0]);
        const playerAverageInitiative = playerOwned.reduce((acc, t) => acc + t.combatant.initiative, 0) / playerOwned.length;
        const nonPlayerAverageInitiative = nonPlayerOwned.reduce((acc, t) => acc + t.combatant.initiative, 0) / nonPlayerOwned.length;
        const updates = [];
        for (const playerOwnedToken of playerOwned) {
            updates.push({
                _id: playerOwnedToken.combatant.id,
                "initiative": playerAverageInitiative,
            });
        }
        for (const nonPlayerOwnedToken of nonPlayerOwned) {
            updates.push({
                _id: nonPlayerOwnedToken.combatant.id,
                "initiative": nonPlayerAverageInitiative,
            });
        }
        await game.combat.updateEmbeddedDocuments("Combatant", updates);
    }

    computeSuccess() {
        if (game.user === game.users.activeGM && getSetting("cleanupMessages")) {
            ChatMessage.deleteDocuments(Array.from(this._messageIds));
        }
        if (!Number.isNumeric(this.rollOptions.DC) && !this.contestants.length) {
            this.createChatRecap(null, null);
            return undefined;
        }
        const dc = this.contestants.length ? this.contestants.reduce((acc, c) => acc + this._results[c.uuid], 0) / this.contestants.length : this.rollOptions.DC;
        let success;
        if (this.rollOptions.useAverage) {
            const average = this.actors.reduce((acc, a) => acc + this._results[a.uuid], 0) / this.actors.length;
            success = average >= dc;
        } else {
            const successCount = this.actors.filter((a) => this._results[a.uuid] >= dc).length;
            const half = Math.ceil(this.actors.length / 2);
            success = successCount >= half;
        }
        this.createChatRecap(dc, success);
        return success;
    }

    async createChatRecap(dc, success) {
        if (game.user !== game.users.activeGM) return;
        if ((this, this.rollOptions.noMessage)) return;
        const recapSetting = getSetting("recapMessage");

        if (recapSetting === "none") return;

        const resultLabel = game.i18n.localize(`${MODULE_ID}.epicRolls.${success ? "success" : "failure"}`);

        const actorEntries = [];
        const contestantEntries = [];
        for (const actor of this.actors) {
            const result = this._results[actor.uuid];
            const roll = this._rolls[actor.uuid];
            const entry = {
                actor,
                result,
                roll,
                success: result >= dc,
            };
            actorEntries.push(entry);
        }
        for (const contestant of this.contestants) {
            const result = this._results[contestant.uuid];
            const roll = this._rolls[contestant.uuid];
            const entry = {
                actor: contestant,
                result,
                roll,
                success: result >= dc,
            };
            contestantEntries.push(entry);
        }

        const template = `modules/${MODULE_ID}/templates/epic-rolls/chat-recap.hbs`;
        const html = await foundry.applications.handlebars.renderTemplate(template, {
            label: this._introLabel,
            dc,
            successLabel: success !== undefined ? resultLabel : null,
            success,
            actors: actorEntries,
            contestants: contestantEntries,
            noDC: !Number.isNumeric(dc),
        });

        ChatMessage.create({
            user: game.user.id,
            whisper: recapSetting === "gm" || this.rollOptions.hideNames ? ChatMessage.getWhisperRecipients("GM") : null,
            speaker: { alias: game.i18n.localize(`${MODULE_ID}.epicRolls.epicRoll`) },
            content: html,
        });
    }

    async resolveRoll(abort, isSuccess) {
        const results = [];
        for (const uuid of Object.keys(this._results)) {
            const actor = fromUuidSync(uuid);
            results.push({ actor, value: this._results[uuid], roll: this._rolls[uuid] });
        }
        this._resolve({ canceled: abort, results, success: isSuccess });
    }

    static async wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    static getRollLabel(rollKey, dc, vs, options = {}) {
        if (options.customLabel) return options.customLabel;

        const getLabel = (key) => {
            const [type, statistic] = key.split(".");
            if (type === "initiative") return game.i18n.localize("COMBAT.InitiativeRoll");
            if (type === "perception") return `${game.i18n.localize("PF2E.PerceptionLabel")} ${game.i18n.localize(`${MODULE_ID}.epicRolls.check`)}`;
            if (type === "skill") return `${game.i18n.localize(CONFIG.PF2E.skills[statistic]?.label ?? statistic)} ${game.i18n.localize(`${MODULE_ID}.epicRolls.check`)}`;
            if (type === "save") return `${game.i18n.localize(CONFIG.PF2E.saves[statistic] ?? statistic)} ${game.i18n.localize(`${MODULE_ID}.epicRolls.save`)}`;
            if (type === "custom") return `${options.formula} ${game.i18n.localize(`${MODULE_ID}.epicRolls.check`)}`;
            return statistic ?? key;
        };

        const label = vs ? `${getLabel(rollKey)} vs ${getLabel(vs)}` : getLabel(rollKey);
        return Number.isNumeric(dc) && !vs ? `${game.i18n.format(`${MODULE_ID}.epicRolls.dc`, { dc })} ${label}` : label;
    }

    async close(...args) {
        ui.PF2eStageEpicRolls._currentRoll = null;
        const res = await super.close({ ...args, animate: false });
        //advance the queue if there is one
        if (ui.PF2eStageEpicRolls._queue.length) {
            const next = ui.PF2eStageEpicRolls._queue.shift();
            next.init().render(true);
        }
        return res;
    }
}

const ROLL_COLORS = {
    perception: 200,
    initiative: 30,
    save: 0,
    skill: 300,
    custom: 120,
};
