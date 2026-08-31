// PF2e Stage Scene — точка входа модуля.

import { registerSettings, applyNameplateImage } from './settings.js';
import { VisualNovelScene } from './visual-dialog/visual-novel-scene.js';
import { VNPresets } from './visual-dialog/vn-state.js';

const MODULE_ID = 'pf2e-stage-scene';

function addStageControl() {
    const layers = document.querySelector('#scene-controls-layers');
    if (!layers || !game.user?.isGM) return;

    layers.querySelector('[data-control="pf2e-stage-scene"]')?.closest('li')?.remove();

    const li = document.createElement('li');
    li.innerHTML = `<button type="button" class="control ui-control layer icon fa-solid fa-theater-masks"
        role="tab" data-action="control" data-control="pf2e-stage-scene" aria-pressed="false"
        aria-label="${game.i18n.localize('vn.scene.title')}" aria-controls="scene-controls-tools"></button>`;
    const button = li.querySelector('button');
    button.addEventListener('click', (event) => {
        event.preventDefault();
        window.visualNovelScene?.openSceneDialog();
        layers.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
    });
    layers.appendChild(li);
}

Hooks.once('init', () => registerSettings());

Hooks.once('socketlib.ready', () => {
    const socket = socketlib.registerModule(MODULE_ID);
    socket.register('vnScene', (data) => window.visualNovelScene?.handleSocketEvent(data));
    VisualNovelScene._pendingSocket = socket;
});

Hooks.once('ready', async () => {
    applyNameplateImage(game.settings.get(MODULE_ID, 'nameplateImage'));

    const scene = new VisualNovelScene();
    await scene.initialize();
    if (VisualNovelScene._pendingSocket) {
        scene.initSocket(VisualNovelScene._pendingSocket);
        delete VisualNovelScene._pendingSocket;
    }
    window.visualNovelScene = scene;
    await scene.restoreStateIfNeeded();
});

Hooks.on('renderSceneControls', addStageControl);
Hooks.on('canvasReady', () => setTimeout(addStageControl, 50));

window.openPF2eStageScene = () => window.visualNovelScene?.openSceneDialog();
window.openVisualNovelScene = window.openPF2eStageScene;
window.launchVNPreset = async (presetId) => {
    const scene = window.visualNovelScene;
    if (!scene) return ui.notifications.warn('PF2e Stage Scene не инициализирован.');
    const preset = await VNPresets.load(presetId);
    if (!preset) return ui.notifications.error(`Пресет сцены «${presetId}» не найден.`);
    scene.createScene(preset);
};
