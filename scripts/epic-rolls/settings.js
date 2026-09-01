import { MODULE_ID } from "./main.js";

export function registerSettings() {
    const settings = {
        recentRolls: {
            scope: "world",
            config: false,
            type: Array,
            default: [],
        },
        defaultOptions: {
            scope: "world",
            config: false,
            type: Object,
            default: {
                formula: "",
                DC: 0,
                showDC: false,
                useAverage: false,
                allowReroll: false,
                showRollResults: true,
                blindRoll: false,
                hideNames: false,
                color: 0,
                autoColor: true,
                customLabel: "",
                noMessage: false,
            },
        },
        recapMessage: {
            name: `epicRolls.settings.recapMessage.name`,
            hint: `epicRolls.settings.recapMessage.hint`,
            scope: "world",
            config: true,
            type: String,
            choices: {
                none: `epicRolls.settings.recapMessage.options.none`,
                gm: `epicRolls.settings.recapMessage.options.gm`,
                public: `epicRolls.settings.recapMessage.options.public`,
            },
            default: "gm",
        },
        cleanupMessages: {
            name: `epicRolls.settings.cleanupMessages.name`,
            hint: `epicRolls.settings.cleanupMessages.hint`,
            scope: "world",
            config: true,
            type: Boolean,
            default: false,
        },

        introSound: {
            name: `epicRolls.settings.introSound.name`,
            hint: `epicRolls.settings.introSound.hint`,
            scope: "world",
            config: true,
            type: String,
            default: "modules/pf2e-stage-scene/assets/epic-rolls/epic_battle_music_1-6275.ogg",
            filePicker: "audio",
        },
        successSound: {
            name: `epicRolls.settings.successSound.name`,
            hint: `epicRolls.settings.successSound.hint`,
            scope: "world",
            config: true,
            type: String,
            default: "",
            filePicker: "audio",
        },
        failureSound: {
            name: `epicRolls.settings.failureSound.name`,
            hint: `epicRolls.settings.failureSound.hint`,
            scope: "world",
            config: true,
            type: String,
            default: "",
            filePicker: "audio",
        },
    };
    registerSettingsArray(settings);
}

export function getSetting(key) {
    return game.settings.get(MODULE_ID, key);
}

export async function setSetting(key, value) {
    return await game.settings.set(MODULE_ID, key, value);
}

function registerSettingsArray(settings) {
    for (const [key, value] of Object.entries(settings)) {
        game.settings.register(MODULE_ID, key, value);
    }
}
