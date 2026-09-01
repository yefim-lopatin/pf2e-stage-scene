import { MODULE_ID } from "../main.js";
import { getSetting, setSetting } from "../settings.js";
import { Socket } from "../lib/socket.js";
import { EpicRoll } from "./EpicRoll.js";
import { HandlebarsApplication, mergeClone } from "../lib/utils.js";

export class GetRollData extends HandlebarsApplication {
    constructor(data = {}) {
        super();
        const defaultOptions = getSetting("defaultOptions") ?? {};
        this.rollData = data;
        this.rollData.options ??= defaultOptions;
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
            tag: "form",
            window: {
                frame: true,
                positioned: true,
                contentClasses: ["standard-form"],
            },
            actions: {
                startEpicRoll: this.startEpicRoll,
                saveToMacro: this.saveToMacro,
            },
            position: {
                width: 800,
                height: 850,
            },
        });
    }

    static get PARTS() {
        return {
            genericForm: {
                template: `modules/${MODULE_ID}/templates/epic-rolls/${this.APP_ID}.hbs`,
                classes: ["standard-form"],
            },
            footer: {
                template: "templates/generic/form-footer.hbs",
            },
        }
    }

    async _prepareContext(options) {
        const actors = this.getActors();
        const rolls = this.getRolls(actors);
        const epicRollButton = {
            type: "button",
            action: "startEpicRoll",
            icon: "fa-duotone fa-dice-d20",
            label: `${MODULE_ID}.epicRolls.get-roll-data.startRoll`,
        };
        const macroButton = {
            type: "button",
            action: "saveToMacro",
            icon: "fa-duotone fa-terminal",
            label: `${MODULE_ID}.epicRolls.get-roll-data.macro`,
        };
        return { actors, rolls, rollData: this.rollData, buttons: [epicRollButton, macroButton] };
    }

    getActors() {
        const useCanvasTokens = canvas.tokens.controlled.length > 0;

        const selected = [];

        const notSelected = [];

        if (this.rollData.actors) {
            const dataActors = this.rollData.actors.concat(this.rollData.contestants ?? []).map((uuid) => fromUuidSync(uuid)).filter(Boolean);
            dataActors.sort((a, b) => a.name.localeCompare(b.name));
            dataActors.sort((a, b) => a.hasPlayerOwner - b.hasPlayerOwner);
            selected.push(...dataActors);
        } else {
            if (!useCanvasTokens) {
                const activeParty = Array.from(game.users)
                    .filter((user) => !user.isGM && user.active && user.character)
                    .map((user) => user.character);
                activeParty.sort((a, b) => a.name.localeCompare(b.name));
                selected.push(...activeParty);
            } else {
                const canvasSelected = canvas.tokens.controlled.map((token) => token.actor).filter((actor) => actor);
                canvasSelected.sort((a, b) => a.name.localeCompare(b.name));
                canvasSelected.sort((a, b) => a.hasPlayerOwner - b.hasPlayerOwner);
                selected.push(...canvasSelected);
            }
        }

        const allAvailable = [];
        const allParty = Array.from(game.users)
            .filter((user) => !user.isGM && user.character)
            .map((user) => user.character);
        allParty.sort((a, b) => a.name.localeCompare(b.name));
        allAvailable.push(...allParty);
        const allPlayerOwned = Array.from(game.actors)
            .filter((actor) => actor.hasPlayerOwner)
            .filter((actor) => !allAvailable.includes(actor));
        allPlayerOwned.sort((a, b) => a.name.localeCompare(b.name));
        allAvailable.push(...allPlayerOwned);
        const allCanvas = canvas.tokens.placeables
            .map((token) => token.actor)
            .filter((actor) => actor)
            .filter((actor) => !allAvailable.includes(actor));
        allCanvas.sort((a, b) => a.name.localeCompare(b.name));
        allAvailable.push(...allCanvas);
        notSelected.push(...allAvailable.filter((actor) => !selected.includes(actor)));

        if (this.rollData.contestants) {
            selected.forEach((actor) => {
                actor.er5eContestant = this.rollData.contestants.includes(actor.uuid);
            });
        }

        return { selected, notSelected };
    }

    getRolls(actors) {
        const skills = Object.entries(CONFIG.PF2E.skills).map(([key, value]) => {
            return {
                type: "skill",
                key,
                label: game.i18n.localize(value.label),
                selected: this.rollData.type === "skill." + key,
                contest: this.rollData.contest === "skill." + key,
            };
        });
        const saves = Object.entries(CONFIG.PF2E.saves).map(([key, value]) => {
            return {
                type: "save",
                key,
                label: game.i18n.localize(value),
                selected: this.rollData.type === "save." + key,
                contest: this.rollData.contest === "save." + key,
            };
        });
        const perception = [{
            type: "perception",
            key: "perception",
            label: game.i18n.localize("PF2E.PerceptionLabel"),
            selected: this.rollData.type === "perception.perception",
            contest: this.rollData.contest === "perception.perception",
        }];
        const initiative = [{
            type: "initiative",
            key: "initiative",
            label: game.i18n.localize("COMBAT.InitiativeRoll"),
            selected: this.rollData.type === "initiative.initiative",
            contest: this.rollData.contest === "initiative.initiative",
        }];
        return {
            skills: {
                icon: "fas fa-briefcase",
                label: game.i18n.localize("PF2E.SkillsLabel"),
                list: skills,
            },
            saves: {
                icon: "fas fa-shield-heart",
                label: game.i18n.localize("PF2E.SavingThrow"),
                list: saves,
            },
            perception: {
                icon: "fas fa-eye",
                label: game.i18n.localize("PF2E.PerceptionLabel"),
                list: perception,
            },
            initiative: {
                icon: "fas fa-swords",
                label: game.i18n.localize("COMBAT.InitiativeRoll"),
                list: initiative,
            },
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;
        html.querySelectorAll(".add-remove").forEach((button) => {
            button.addEventListener("click", this._onAddRemove.bind(this));
        });
        html.querySelectorAll(`input[type="search"]`).forEach((input) => {
            input.addEventListener("input", this._onSearch.bind(this));
        });
        html.querySelectorAll("li.actor").forEach((li) => {
            li.addEventListener("contextmenu", this._onActorRightClick.bind(this));
        });
        html.querySelectorAll(".roll").forEach((li) => {
            li.addEventListener("click", this._onRollTypeClick.bind(this));
            li.addEventListener("contextmenu", this._onRollTypeRightClick.bind(this));
        });
        html.querySelectorAll(".toggle").forEach((button) => {
            button.addEventListener("click", this._onToggle.bind(this));
        });
        //html.querySelector("#start-epic-roll").addEventListener("click", this.startEpicRoll.bind(this));
        //html.querySelector("#macro").addEventListener("click", this.saveToMacro.bind(this));
        html.querySelector("#color").addEventListener("change", (event) => {
            html.querySelector(".color-preview").style.filter = `hue-rotate(${event.target.value}deg)`;
        });
        html.querySelector(".save-default").addEventListener("click", this._saveDefault.bind(this));
    }

    async _saveDefault() {
        const data = this._compileRollData(true);
        const options = data.options;
        await setSetting("defaultOptions", options);
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.${this.APP_ID}.saveDefaultOptionsNotification`));
    }

    _onAddRemove(event) {
        const currentList = event.currentTarget.closest("ul");
        const targetList = Array.from(currentList.closest(".roll-actor-list").querySelectorAll("ul")).find((list) => list !== currentList);
        const li = event.currentTarget.closest("li");
        targetList.prepend(li);
        event.currentTarget.classList.toggle("fa-plus");
        event.currentTarget.classList.toggle("fa-minus");
    }

    _onActorRightClick(event) {
        const li = event.currentTarget;
        li.classList.toggle("contestant");
    }

    _onRollTypeClick(event) {
        this.element.querySelectorAll(".roll").forEach((li) => {
            if (li !== event.currentTarget) {
                li.classList.remove("selected");
            }
        });
        const li = event.currentTarget;
        li.classList.remove("contestant");
        li.classList.toggle("selected");
    }

    _onRollTypeRightClick(event) {
        this.element.querySelectorAll(".roll").forEach((li) => {
            if (li !== event.currentTarget) {
                li.classList.remove("contestant");
            }
        });
        const li = event.currentTarget;
        li.classList.remove("selected");
        li.classList.toggle("contestant");
    }

    _onToggle(event) {
        event.currentTarget.classList.toggle("fa-toggle-on");
        event.currentTarget.classList.toggle("fa-toggle-off");
    }

    _onSearch(event) {
        //const ul = event.currentTarget.closest("filigree-box");
        const ul = event.currentTarget.closest(".section-border")
        const search = event.currentTarget.value.toLowerCase();
        const lis = ul.querySelectorAll("li");
        for (const li of lis) {
            if (!search) {
                li.classList.remove("er5e-hidden");
                continue;
            }
            const name = li.dataset.name.toLowerCase();
            const subtitle = li.querySelector(".subtitle")?.innerText.toLowerCase() ?? "";
            if (name.includes(search) || subtitle.includes(search)) {
                li.classList.remove("er5e-hidden");
            } else {
                li.classList.add("er5e-hidden");
            }
        }
    }

    static async saveToMacro() {
        const rollData = this._compileRollData();
        if (!rollData) return;
        const rollLabel = EpicRoll.getRollLabel(rollData.type, rollData.options.DC, rollData.contest, rollData.options);
        Macro.create({
            name: rollLabel,
            type: "script",
            scope: "global",
            command: `ui.PF2eStageEpicRolls.requestRoll(${JSON.stringify(rollData)})`,
        });
        ui.notifications.info(game.i18n.localize(`${MODULE_ID}.${this.APP_ID}.save-macro`) + rollLabel);
    }

    static async startEpicRoll() {
        const rollData = this._compileRollData();
        if (!rollData) return;
        const recentRolls = getSetting("recentRolls");
        try {
            const recentRollsLabels = recentRolls.map((roll) => EpicRoll.getRollLabel(roll.type, roll.options.DC, roll.contest, roll.options));
            const currentRollLabel = EpicRoll.getRollLabel(rollData.type, rollData.options.DC, rollData.contest, rollData.options);
            if (!recentRollsLabels.includes(currentRollLabel)) {
                recentRolls.unshift(rollData);
                recentRolls.splice(10);
                setSetting("recentRolls", recentRolls);
            }
        } catch (e) {
            console.error("Epic Rolls: Error encountered parsing recent rolls. Recent rolls will be reset.");
            setSetting("recentRolls", []);
        }
        Socket.dispatchEpicRoll(rollData);
        this.close();
    }

    _compileRollData(ignoreErrors = false) {
        const selectedActors = this.element.querySelectorAll(".selected-actors .actor:not(.contestant)");
        const contestants = this.element.querySelectorAll(".selected-actors .contestant");
        const rollType = this.element.querySelector(".roll-types .selected");
        const rollContest = this.element.querySelector(".roll-types .contestant");
        const rollOptions = {};
        const formGroups = Array.from(this.element.querySelectorAll(".form-group"));
        for (const group of formGroups) {
            const input = group.querySelector("input");
            if (input) {
                rollOptions[group.dataset.name] = input.type === "number" ? parseInt(input.value) : input.value;
            } else {
                const checkbox = group.querySelector("i");
                rollOptions[group.dataset.name] = checkbox.classList.contains("fa-toggle-on");
            }
        }

        const rollData = {
            actors: Array.from(selectedActors).map((li) => li.dataset.uuid),
            contestants: Array.from(contestants).map((li) => li.dataset.uuid),
            type: rollType ? rollType.dataset.type + "." + rollType.dataset.key : null,
            contest: rollContest ? rollContest.dataset.type + "." + rollContest.dataset.key : null,
            options: rollOptions,
        };

        if (rollData.contestants.length && !rollData.contest) {
            rollData.contest = rollData.type;
        }

        if (ignoreErrors) return rollData;

        let error;

        if (!rollData.actors.length) {
            error = "noActors";
        }
        if (!rollData.type) {
            error = "noType";
        }
        if (rollData.contest && !rollData.contestants.length) {
            error = "noContestants";
        }

        if (error) {
            ui.notifications.error(game.i18n.localize(`${MODULE_ID}.${this.APP_ID}.ERROR.${error}`));
            return null;
        }

        return rollData;
    }

    _updateObject(event, formData) {}

    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();
        buttons.forEach((button) => {
            button.label = "";
        });
        return buttons;
    }
}
