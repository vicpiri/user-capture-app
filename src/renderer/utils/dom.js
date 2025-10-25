/**
 * DOM Utilities
 *
 * Common DOM manipulation helpers.
 *
 * @module utils/dom
 */

/**
 * Get element by ID with optional error handling
 * @param {string} id - Element ID
 * @param {boolean} required - Throw error if not found
 * @returns {HTMLElement|null}
 */
function getElementById(id, required = false) {
  const element = document.getElementById(id);
  if (!element && required) {
    throw new Error(`Required element with id '${id}' not found`);
  }
  return element;
}

/**
 * Get element by selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {HTMLElement|null}
 */
function querySelector(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Get all elements by selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {NodeList}
 */
function querySelectorAll(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Show element
 * @param {HTMLElement} element
 */
function show(element) {
  if (element) {
    element.style.display = '';
    element.classList.remove('hidden');
  }
}

/**
 * Hide element
 * @param {HTMLElement} element
 */
function hide(element) {
  if (element) {
    element.style.display = 'none';
    element.classList.add('hidden');
  }
}

/**
 * Toggle element visibility
 * @param {HTMLElement} element
 * @param {boolean} force - Force show (true) or hide (false)
 */
function toggle(element, force) {
  if (!element) return;

  if (typeof force === 'boolean') {
    force ? show(element) : hide(element);
  } else {
    element.style.display === 'none' ? show(element) : hide(element);
  }
}

/**
 * Enable element
 * @param {HTMLElement} element
 */
function enable(element) {
  if (element) {
    element.disabled = false;
    element.classList.remove('disabled');
  }
}

/**
 * Disable element
 * @param {HTMLElement} element
 */
function disable(element) {
  if (element) {
    element.disabled = true;
    element.classList.add('disabled');
  }
}

/**
 * Add class to element
 * @param {HTMLElement} element
 * @param {string} className
 */
function addClass(element, className) {
  if (element) {
    element.classList.add(className);
  }
}

/**
 * Remove class from element
 * @param {HTMLElement} element
 * @param {string} className
 */
function removeClass(element, className) {
  if (element) {
    element.classList.remove(className);
  }
}

/**
 * Toggle class on element
 * @param {HTMLElement} element
 * @param {string} className
 * @param {boolean} force
 */
function toggleClass(element, className, force) {
  if (element) {
    element.classList.toggle(className, force);
  }
}

/**
 * Set text content safely
 * @param {HTMLElement} element
 * @param {string} text
 */
function setText(element, text) {
  if (element) {
    element.textContent = text || '';
  }
}

/**
 * Set HTML content (use with caution - sanitize first)
 * @param {HTMLElement} element
 * @param {string} html
 */
function setHTML(element, html) {
  if (element) {
    element.innerHTML = html || '';
  }
}

/**
 * Clear element content
 * @param {HTMLElement} element
 */
function clear(element) {
  if (element) {
    element.innerHTML = '';
  }
}

/**
 * Create element with attributes
 * @param {string} tag - Tag name
 * @param {object} attributes - Attributes object
 * @param {string} text - Text content
 * @returns {HTMLElement}
 */
function createElement(tag, attributes = {}, text = '') {
  const element = document.createElement(tag);

  Object.keys(attributes).forEach(key => {
    if (key === 'class') {
      element.className = attributes[key];
    } else if (key === 'data') {
      Object.keys(attributes[key]).forEach(dataKey => {
        element.dataset[dataKey] = attributes[key][dataKey];
      });
    } else {
      element.setAttribute(key, attributes[key]);
    }
  });

  if (text) {
    element.textContent = text;
  }

  return element;
}

/**
 * Remove element from DOM
 * @param {HTMLElement} element
 */
function removeElement(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * Wait for element to exist
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<HTMLElement>}
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element '${selector}' not found within ${timeout}ms`));
    }, timeout);
  });
}

// Export all functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getElementById,
    querySelector,
    querySelectorAll,
    show,
    hide,
    toggle,
    enable,
    disable,
    addClass,
    removeClass,
    toggleClass,
    setText,
    setHTML,
    clear,
    createElement,
    removeElement,
    waitForElement
  };
}
