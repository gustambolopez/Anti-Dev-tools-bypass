// ==UserScript==
// @name         s16.bypass
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  bypass for disabledevtools npm package and anti debugger
// @author       s16dih (the real monkey)
// @match        *://*/*
// @grant        none
// @run-at       document_start
// ==/UserScript==

(function() {
    'use strict';

     // bypass babyyyyyyyyyyy
    window.debugger = () => {};

    // patches
    Function.prototype.constructor = new Proxy(Function.prototype.constructor, {
        apply(fn, ctx, args) {
            if (typeof args[0] === 'string') {
                args[0] = args[0].replace(/debugger/g, '');
            }
            return Reflect.apply(fn, ctx, args);
        }
    });


    Function.prototype.toString = new Proxy(Function.prototype.toString, {
        apply(fn, ctx, args) {
            if (ctx === window.debugger) {
                return 'function debugger() { [native code] }';
            }
            return Reflect.apply(fn, ctx, args);
        }
    });


    const origEval = window.eval;
    window.eval = code => (typeof code === 'string' ? origEval(code.replace(/debugger;?/g, '')) : origEval(code));

    // patch console
    ['log', 'debug', 'error', 'info', 'warn'].forEach(method => {
        const orig = console[method];
        console[method] = (...args) => {
            if (!args.some(arg => arg instanceof Image)) {
                return orig.apply(console, args);
            }
        };
    });

    // block console clear
    console.clear = () => console.log('[Tampermonkey] console clear blocked.');

    // a bunch of spoofs
    const spoofWindowSize = () => {
        Object.defineProperty(window, 'outerWidth', { get: () => innerWidth, configurable: true });
        Object.defineProperty(window, 'outerHeight', { get: () => innerHeight, configurable: true });
    };

    spoofWindowSize();
    setInterval(spoofWindowSize, 1000);


    const rAF = window.requestAnimationFrame;
    window.requestAnimationFrame = cb => rAF(t => cb(t + 1000));

    document.addEventListener('keydown', e => {
        if (['F12', 'U'].includes(e.key.toUpperCase()) || (e.ctrlKey && e.shiftKey && ['J', 'C'].includes(e.key.toUpperCase()))) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, true);

    const imgProto = Object.getPrototypeOf(new Image());
    if (imgProto) {
        Object.defineProperty(imgProto, 'id', { get: () => null, configurable: true });
    }

    // spoof for the reload check
    try {
        if (performance.getEntriesByType("navigation")[0].type === "reload") {
            Object.defineProperty(performance, 'getEntriesByType', {
                value: () => [{ type: "navigate" }],
                configurable: true
            });
        }
    } catch {}

    // spoof navigator
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3], configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });


    Object.getOwnPropertyDescriptor = new Proxy(Object.getOwnPropertyDescriptor, {
        apply(fn, ctx, args) {
            if (args[0] === HTMLElement.prototype && args[1] === 'toString') {
                return { configurable: true, enumerable: false, value: () => '[object HTMLElement]' };
            }
            return Reflect.apply(fn, ctx, args);
        }
    });

    const TARGET = 'cdn.jsdelivr.net/npm/disable-devtool';
    let detected = false;

    // override baits
    const applyBypass = () => {
        if (detected) return;
        detected = true;
        console.log('[Bypass Devtool] specific script found. applying\ bypass.');

        const defProp = Object.defineProperty;
        Object.defineProperty = function(obj, prop, desc) {
            if (typeof prop === 'string' && /devtool|debugger|inner|outer/.test(prop)) {
                console.warn(`[Bypass Devtool] blocking defineProperty on ${prop}.`);
                return obj;
            }
            return defProp.apply(this, arguments);
        };

        // override timeout
        const safeSet = (originalFn, label) => function(cb, dly, ...rest) {
            if (typeof cb === 'string' && cb.includes('debugger')) {
                console.warn(`[Bypass Devtool] blocking ${label} with debugger string.`);
                return 0;
            }
            return originalFn.call(this, cb, dly, ...rest);
        };

        window.setInterval = safeSet(setInterval, 'setInterval');
        window.setTimeout = safeSet(setTimeout, 'setTimeout');

        // right-click trap bypass
        document.addEventListener('contextmenu', e => {
            console.log('[Bypass Devtool] preventing\ context menu.');
            e.stopImmediatePropagation();
        }, true);

           // remove the anti dev tools script
        document.querySelectorAll(`script[src*="${TARGET}"]`).forEach(script => {
            console.log('[Bypass Devtool] removing\ anti dev tools script:', script.src);
            script.remove();
        });
    };

    // look for the script
    const checkScripts = () => {
        return [...document.querySelectorAll('script[src]')].some(s => {
            if (s.src.includes(TARGET)) {
                console.log('[Bypass Devtool] script found in dom (cumming soon ).');
                applyBypass();
                return true;
            }
            return false;
        });
    };


    new MutationObserver(muts => {
        muts.forEach(m => {
            m.addedNodes.forEach(n => {
                if (n.tagName === 'SCRIPT' && n.src && n.src.includes(TARGET)) {
                    console.log('[Bypass Devtool] detected and removing\ dynamic script:', n.src);
                    n.remove();
                    applyBypass();
                }
            });
        });
    }).observe(document.documentElement, { childList: true, subtree: true });

    checkScripts();

    console.log('[Tampermonkey] anti devtools blocked.');

