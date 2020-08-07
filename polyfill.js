/*
 * CSS aspect-ration polyfill.
 * 2020-08-06
 *
 * By Dima Voytenko, https://github.com/dvoytenko
 * Public domain.
 * NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.
 */
"use strict";

/**
 * @fileoverview This is a polyfill for CSS "aspect-ratio" property. It's only
 * installed when "aspect-ratio" property is not supported. It works as
 * following:
 * - The developer should put the "aspect-ratio" attribute on a DOM element
 *   that defines the "aspect-ratio" in a stylesheet or styles. The format
 *   is the same, e.g. "4/3".
 * - If the stylesheet defines many different "aspect-ratio" values based on
 *   different selectors and/or media queries, the developer should pick one
 *   fallback value for the "aspect-ratio" attribute. Alternatively, the
 *   attribute value can be changed in JavaScript.
 * - Not all layout scenarios are supported. Feel free to send patches.
 */

/**
 * @param {!Window} win
 */
function installPolyfill(win) {
  // TODO: exit if `CSS.supports('aspect-ratio: 1/1') == true`. For now it's
  // open for the side-by-side testing.

  const doc = win.document;

  const targets = new Map();

  // TODO: support shadow DOM.
  const domObserver = new win.MutationObserver(
    (records) => processMutations(records));
  domObserver.observe(doc, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  });

  /**
   * @param {!Array<!MutationRecord>} records
   */
  function processMutations(records) {
    const candidates = doc.querySelectorAll('[aspect-ratio]');
    const newTargets = [];
    for (let i = 0; i < candidates.length; i++) {
      const target = candidates[i];
      if (newTargets.indexOf(target) != -1) {
        continue;
      }
      const oldAspectRatio = targets.get(target);
      const newAspectRatio = target.getAttribute('aspect-ratio');
      if (newAspectRatio !== oldAspectRatio) {
        newTargets.push(target);
        if (newAspectRatio) {
          targets.set(target, newAspectRatio);
        } else {
          targets.delete(target);
        }
      }
    }

    cleanupDisconnectedTargets();
    applyAll();
  }

  function cleanupDisconnectedTargets() {
    let toRemove = null;
    targets.forEach((_, target) => {
      if (!isConnected(target)) {
        if (!toRemove) {
          toRemove = [];
        }
        toRemove.push(target);
      }
    });
    if (toRemove) {
      toRemove.forEach((target) => targets.delete(target));
    }
  }

  /**
   * @param {!Node} target
   * @return {boolean}
   */
  function isConnected(target) {
    const native = target.isConnected;
    if (native !== undefined) {
      return native;
    }
    // From https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected
    return (
      !target.ownerDocument ||
      !(
        target.ownerDocument.compareDocumentPosition(target) &
        target.DOCUMENT_POSITION_DISCONNECTED
      )
    );
  }

  function applyAll() {
    targets.forEach((_, target) => {
      applyTarget(target);
    });
    domObserver.takeRecords();
  }

  /**
   * @param {!Element} target
   */
  function applyTarget(target) {
    // TODO: cleanup only what changed and restore prev values.
    target.style.height = '';
    target.style.width = '';

    const aspectRatioStr = target.getAttribute('aspect-ratio');
    const [w, h] = aspectRatioStr ? aspectRatioStr.split('/').map(Number) : [0, 0];
    const ratio = w / h;
    if (!ratio) {
      return;
    }

    // TODO: go up the parent DOM until display != contents.
    const parent = target.parentElement;
    const parentStyles = win.getComputedStyle(parent);

    // TODO: support "hw" bound.
    const flexRow =
      (parentStyles.display || '').indexOf('flex') != -1 &&
      parentStyles.flexDirection == 'row';
    const bound = flexRow ? 'h' : 'w';

    const styles = win.getComputedStyle(target);
    const width = parseNum(styles.width, 0);
    const height = parseNum(styles.height, 0);
    const minWidth = parseNum(styles.minWidth, 0);
    const minHeight = parseNum(styles.minHeight, 0);
    const maxWidth = parseNum(styles.maxWidth, Number.POSITIVE_INFINITY);
    const maxHeight = parseNum(styles.maxHeight, Number.POSITIVE_INFINITY);

    if (bound == 'w') {
      const newHeight = clamp(width / ratio, minHeight, maxHeight);
      if (newHeight < Number.POSITIVE_INFINITY) {
        target.style.height = newHeight + 'px';
      }
    } else if (bound == 'h') {
      const newWidth = clamp(height * ratio, minWidth, maxHeight);
      if (newWidth < Number.POSITIVE_INFINITY) {
        target.style.width = newWidth + 'px';
      }
    }
  }

  /**
   * @param {number} v
   * @param {number} min
   * @param {number} max
   * @return {number}
   */
  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  /**
   * @param {string} s
   * @param {number} def
   */
  function parseNum(s, def) {
    const v = parseFloat(s);
    return isNaN(v) ? def : v;
  }

  win.addEventListener('readystatechange', applyAll);
  win.addEventListener('resize', applyAll);
  processMutations([]);
}

setTimeout(() => installPolyfill(window));
