"use strict";

function installPolyfill(win) {
  const doc = win.document;

  const targets = new Map();

  const domObserver = new win.MutationObserver(
    (records) => processMutations(records));
  domObserver.observe(doc, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true
  });

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

  function applyTargets(targets) {
    for (let i = 0; i < targets.length; i++) {
      applyTarget(targets[i]);
    }
  }

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

  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function parseNum(s, def) {
    const v = parseFloat(s);
    return isNaN(v) ? def : v;
  }

  win.addEventListener('readystatechange', applyAll);
  win.addEventListener('resize', applyAll);
  processMutations([]);
}

setTimeout(() => installPolyfill(window));
