
"use strict";
/*jslint browser: true, nomen: true, regexp: true*/

var Cookie      = require('./cookie'),
    Device      = require('./device'),
    User        = require('./user'),
    each        = require('each'),
    extend      = require('extend'),
    isEmpty     = require('is-empty'),
    querystring = require('querystring'),
    type        = require('type'),
    DEFAULTHOST = null,
    DEFAULTPORT = 80;

function Skybox() {
    this.apiKey = null;
    this.host = DEFAULTHOST;
    this.port = DEFAULTPORT;
    this.cookie = new Cookie();
    this.device = new Device();
    this.user = new User();
    this.initialized = false;
    this.resource(function () {
        return this.path().replace(/\/\d+(?=\/|\b)/g, "/:id");
    });
}

Skybox.prototype.initialize = function (apiKey, options) {
    var self = this;
    this.apiKey = apiKey;
    this.options(options);
    this.initialized = true;
};

Skybox.prototype.init = Skybox.prototype.inititialize;

/**
 * Attempts to automatically initialize based on data attributes in the script tag:
 * 
 * <script data-api-key="XXX-XXXX"/>
 */
Skybox.prototype.autoinitialize = function () {
    var arr, re, script = this.scriptElement();
    if (script === null) {
        return;
    }

    // Extract API key.
    if (this.apiKey === null && script.getAttribute("data-api-key") !== null) {
        this.initialize(script.getAttribute("data-api-key"));
    }

    // Extract host and port of script.
    if (this.host === null) {
        re = /^(?:https?:)?\/\/([^\/]+).*/;
        if (script.src.search(re) === 0) {
            arr = script.src.replace(re, "$1").split(":");
            this.host = arr[0];
            if (arr.length > 1 && !isNaN(parseInt(arr[1], 10))) {
                this.port = parseInt(arr[1], 10);
            }
        }
    }

    // Automatically track the page.
    this.page();
};

/**
 * Sets or retrieves the current options.
 */
Skybox.prototype.options = function (value) {
    if (arguments.length === 0) {
        return this._options;
    }
    var options = value || {};
    this._options = options;
    this.cookie.options(options.cookie);
    this.device.options(options.device);
    this.user.options(options.user);
};

/**
 * Identify a user by `id`.
 */
Skybox.prototype.identify = function (id) {
    this.user.identify(id);
    return this;
};

/**
 * Track an event that a user has triggered.
 */
Skybox.prototype.track = function (action) {
    var url, q, el, self = this,
        attr = this._options.mode === "test" ? "title" : "src",
        event = {
            channel: "web",
            resource: this.resource(),
            action: action,
            domain: this.domain(),
            path: this.path(),
        };

    // Ignore if not initialized yet.
    if (!this.initialized) {
        this.log("tracking not allowed before initialization");
        return this;
    }

    // Generate url.
    q = extend(event, {
        apiKey: this.apiKey,
        user: this.user.serialize(),
        device: this.device.serialize()
    });
    url = this.url("/track.png", q);

    // Send to server.
    el = document.createElement("img");
    el.width = el.height = 1;
    el[attr] = url;
    document.body.appendChild(el);

    // Remove the tracker image after it's had time to send.
    setTimeout(function () {
        try {
            document.body.removeChild(el);
        } catch (e) {
        }
    }, 100);

    return this;
};

/**
 * Tracks a page view. This is called automatically after initialization
 * but is useful to call for single-page apps.
 */
Skybox.prototype.page = function (name) {
    return this.track("view");
};

/**
 * Sets or retrieves the current resource. If set to a function then the
 * resource will be the result of the function.
 */
Skybox.prototype.resource = function (value) {
    if (arguments.length === 0) {
        return this._resource();
    }
    var v = (typeof (value) === "function" ? value : function () { return value; });
    this._resource = v;
};

/**
 * Retrieves the current domain of the page.
 */
Skybox.prototype.domain = function () {
    return window.location.host.replace(/:80$/, "");
};

/**
 * Retrieves the current path of the page.
 */
Skybox.prototype.path = function () {
    return window.location.pathname.replace(/\/+$/, "");
};

/**
 * Returns a URL with the appropriate host, port, path and query string.
 */
Skybox.prototype.url = function (path, q) {
    var i, key, params = {},
        str = "";

    // Setup scheme://host:port/path
    str += ('https:' === document.location.protocol ? "https://" : "http://");
    str += (isEmpty(this.host) ? "localhost" : this.host);
    str += (isEmpty(this.port) || this.port === 80 ? "" : ":" + this.port);
    str += path;

    // Flatten query parameters.
    if (type(q) === "object") {
        for (key in q) {
            if (q.hasOwnProperty(key)) {
                if (type(q[key]) === "object") {
                    for (i in q[key]) {
                        if (q[key].hasOwnProperty(i)) {
                            params[key + "." + i] = q[key][i];
                        }
                    }
                } else {
                    params[key] = q[key];
                }
            }
        }
    }

    // Append parameters to the end, if there are any.
    if (!isEmpty(params)) {
        str += "?" + querystring.stringify(params);
    }

    return str;
};

/**
 * Retrieves a reference to the first script element that loaded "skybox.js".
 */
Skybox.prototype.scriptElement = function () {
    var i, scripts = document.getElementsByTagName("script");
    for (i = 0; i < scripts.length; i += 1) {
        if (scripts[i].src.search(/\/skybox.js(?!\/)/) !== -1) {
            return scripts[i];
        }
    }
    return null;
};

Skybox.prototype.log = function (msg) {
    if (window.console) {
        window.console.log("[skybox.js]: " + msg);
    }
};

module.exports = Skybox;

Skybox.VERSION = Skybox.prototype.VERSION = '0.1.0';

