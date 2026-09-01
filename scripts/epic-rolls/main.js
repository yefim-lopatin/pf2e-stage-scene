import { initConfig } from "./config.js";
import { registerSettings } from "./settings.js";
import { GetRollData } from "./app/getRollData.js";
import { EpicRoll } from "./app/EpicRoll.js";
import { Socket } from "./lib/socket.js";
import { APIQueue } from "./lib/api.js";

export const MODULE_ID = "pf2e-stage-scene";

const API_REQUEST_QUEUE = new APIQueue();

function getStageRollData(scene) {
    const state = scene?.state;
    if (!state) return {};

    const ids = [state.leftIds, state.centerIds, state.rightIds].flat();
    const tokens = scene.constructor.resolveTokens(ids, state.portraitImages, state.portraitNames);
    const actors = [...new Map(tokens.map((token) => [token.actor?.uuid, token.actor]).filter(([uuid]) => uuid)).values()];
    const playerActors = actors.filter((actor) => actor.hasPlayerOwner).map((actor) => actor.uuid);
    const npcActors = actors.filter((actor) => !actor.hasPlayerOwner).map((actor) => actor.uuid);

    return {
        actors: playerActors.length ? playerActors : actors.map((actor) => actor.uuid),
        contestants: playerActors.length ? npcActors : [],
    };
}

function openFromScene(scene) {
    if (!game.user.isGM) {
        return ui.notifications.warn(game.i18n.localize(`epicRolls.gmOnly`));
    }
    const data = getStageRollData(scene);
    const options = foundry.utils.deepClone(game.settings.get(MODULE_ID, "defaultOptions"));
    new GetRollData({ ...data, type: "", contest: null, options }).render(true);
}

Hooks.once("init", () => {
    globalThis.ui.PF2eStageEpicRolls = {
        EpicRoll,
        GetRollData,
        Socket,
        _queue: [],
        openFromScene,
        requestRoll: async (data) => {
            if (data.actors) data.actors = data.actors.map((actor) => actor?.uuid || actor);
            if (data.contestants) data.contestants = data.contestants.map((actor) => actor?.uuid || actor);
            const activeGM = game.users.activeGM;
            if (!activeGM) return { error: "no-active-gm" };
            const response = await Socket.routeRequest(data, { users: [activeGM.id] });
            return response[0]?.response;
        },
    };
    window.PF2eStageEpicRolls = globalThis.ui.PF2eStageEpicRolls;
    initConfig();
    registerSettings();
});

Hooks.once("ready", () => {
    Socket.register("updateEpicRoll", (data) => ui.PF2eStageEpicRolls._currentRoll?.update(data));
    Socket.register("routeRequest", async (data) => {
        const response = await API_REQUEST_QUEUE.queueResponse(data);
        if (response.error) return { error: response.error };
        if (response.queue) return ui.PF2eStageEpicRolls._queue[response.index]?.promise;
        return ui.PF2eStageEpicRolls._currentRoll?.promise;
    }, { response: true });
    Socket.register("dispatchEpicRoll", (data) => {
        if (ui.PF2eStageEpicRolls._currentRoll) {
            const roll = new EpicRoll(data);
            ui.PF2eStageEpicRolls._queue.push(roll);
            return { queue: true, index: ui.PF2eStageEpicRolls._queue.length - 1 };
        }
        new EpicRoll(data).init().render({ force: true });
        return { response: true };
    }, { response: true });
    Socket.register("endEpicRoll", (data) => ui.PF2eStageEpicRolls._currentRoll?.endEpicRoll(data));
    Socket.register("toggleRollButton", (data) => ui.PF2eStageEpicRolls._currentRoll?.toggleRollButton(data.uuid, data.rolling));
    Socket.register("recoverQueue", () => {
        const currentRoll = ui.PF2eStageEpicRolls._currentRoll;
        const current = currentRoll ? {
            ...currentRoll.rollData,
            recovered: {
                results: currentRoll._results,
                rolls: currentRoll._rolls,
                messageIds: Array.from(currentRoll._messageIds),
            },
        } : null;
        return { queue: ui.PF2eStageEpicRolls._queue.map((roll) => roll.rollData), current };
    }, { response: true });
    recoverQueue();
});

async function recoverQueue() {
    const responses = await Socket.recoverQueue({});
    const queues = responses.map((response) => response.response?.queue).filter(Array.isArray);
    const current = responses.map((response) => response.response?.current).find(Boolean);
    const queue = queues.sort((a, b) => b.length - a.length)[0] ?? [];
    queue.forEach((data) => ui.PF2eStageEpicRolls._queue.push(new EpicRoll(data)));
    if (current) new EpicRoll(current).init().render(true);
}
