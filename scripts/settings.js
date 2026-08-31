const MODULE_ID = 'pf2e-stage-scene';

const NAMEPLATE_CONFIGS = {
    'modules/pf2e-stage-scene/assets/dialog name labels/name_label_drakkenheim.webp': {
        label: 'Drakkenheim', ratio: 4.94, height: '3.2em', paddingX: '2.2em'
    }
};

function registerSettings() {
    const register = (key, options) => game.settings.register(MODULE_ID, key, options);

    register('nameplateImage', {
        name: 'settings.nameplateImage.name', hint: 'settings.nameplateImage.hint',
        scope: 'world', config: true, type: String,
        default: 'modules/pf2e-stage-scene/assets/dialog name labels/name_label_drakkenheim.webp',
        onChange: applyNameplateImage
    });
    register('backgroundFolder', { scope: 'world', config: false, type: String, default: '' });
    register('parallaxEnabled', {
        name: 'settings.parallaxEnabled.name', hint: 'settings.parallaxEnabled.hint',
        scope: 'client', config: true, type: Boolean, default: true,
        onChange: enabled => window.visualNovelScene?.setParallaxOptions({ enabled })
    });
    register('parallaxDepth', {
        name: 'settings.parallaxDepth.name', hint: 'settings.parallaxDepth.hint',
        scope: 'client', config: true, type: Number, default: 50,
        range: { min: 0, max: 100, step: 10 },
        onChange: depth => window.visualNovelScene?.setParallaxOptions({ depth })
    });
    register('cameraEnabled', {
        name: 'settings.cameraEnabled.name', hint: 'settings.cameraEnabled.hint',
        scope: 'client', config: true, type: Boolean, default: true,
        onChange: enabled => window.visualNovelScene?.setCameraEnabled(enabled)
    });
    register('cameraDoF', {
        name: 'settings.cameraDoF.name', hint: 'settings.cameraDoF.hint',
        scope: 'client', config: true, type: Boolean, default: true,
        onChange: () => window.visualNovelScene?._reapplyCameraDof()
    });
    register('kenBurnsDirection', {
        name: 'settings.kenBurnsDirection.name', hint: 'settings.kenBurnsDirection.hint',
        scope: 'client', config: true, type: String, default: 'none',
        choices: { none: 'settings.kenBurnsDirection.none', random: 'settings.kenBurnsDirection.random', left: 'settings.kenBurnsDirection.left', right: 'settings.kenBurnsDirection.right' },
        onChange: direction => window.visualNovelScene?.setParallaxOptions({ kenBurns: { enabled: direction !== 'none', direction } })
    });
}

function escapeCSSUrl(url) {
    return url.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r]/g, '');
}

function applyNameplateImage(path) {
    document.body.classList.remove('vn-nameplate-hidden');
    if (path === '__hidden__') {
        document.documentElement.style.removeProperty('--vn-nameplate-image');
        document.body.classList.remove('vn-nameplate-has-image');
        document.body.classList.add('vn-nameplate-hidden');
        return;
    }
    if (!path) {
        document.documentElement.style.removeProperty('--vn-nameplate-image');
        document.body.classList.remove('vn-nameplate-has-image');
        return;
    }
    const url = /^https?:\/\/|^\//.test(path) ? path : '/' + path;
    const config = NAMEPLATE_CONFIGS[path] || {};
    document.documentElement.style.setProperty('--vn-nameplate-image', `url("${escapeCSSUrl(url)}")`);
    document.documentElement.style.setProperty('--vn-nameplate-ratio', config.ratio ?? 4.94);
    document.documentElement.style.setProperty('--vn-nameplate-height', config.height ?? '2.8em');
    document.documentElement.style.setProperty('--vn-nameplate-padding-x', config.paddingX ?? '1.8em');
    document.body.classList.add('vn-nameplate-has-image');
}

export { registerSettings, applyNameplateImage, NAMEPLATE_CONFIGS };
