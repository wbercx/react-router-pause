import React from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import bindAll from 'lodash/bindAll';
import cloneDeep from 'lodash/cloneDeep';
import isFunction from 'lodash/isFunction';
import isNull from 'lodash/isNull';
import isUndefined from 'lodash/isUndefined';
import pick from 'lodash/pick';
import isObjectLike from 'lodash/isObjectLike';

/**
 * Helper to determine if object is a thenable; ie: a promise
 *
 * @param {*} obj
 * @returns {boolean}
 */
var isPromise = function isPromise(obj) {
  return isObjectLike(obj) && isFunction(obj.then);
};

var isSameFunction = function isSameFunction(fn1, fn2) {
  return isFunction(fn1) && isFunction(fn2) && (fn1 === fn2 || fn1.name === fn2.name) &&
  // All Jest mocks have same name; treat them as 'different mock-functions'
  fn1.name !== 'mockConstructor';
};

/**
 * Helper to create a fingerprint string for easy comparisons.
 * Note that 'hash' is not fingerprinted; handled by this.beforeRouteChange().
 *
 * @param {Object} location 	The router.history.location object
 * @returns {string}            Unique identifier for this location
 */
var fingerprint = function fingerprint(location) {
  return JSON.stringify(pick(location, ['pathname', 'search', 'state']));
};

var defaultConfig = {
	allowBookmarks: true
};

/**
 * @public
 * @constructor
 * @returns {Null}
 */

var ReactRouterPause = function (_React$Component) {
	babelHelpers.inherits(ReactRouterPause, _React$Component);

	function ReactRouterPause(props) {
		babelHelpers.classCallCheck(this, ReactRouterPause);

		// Final config from defaultConfig and props.config
		var _this = babelHelpers.possibleConstructorReturn(this, (ReactRouterPause.__proto__ || Object.getPrototypeOf(ReactRouterPause)).call(this, props));

		_this.config = {};

		// Temporary flag so can skip blocking 'the next' navigation event
		_this.ignoreNextNavigationEvent = false;

		// Cache the location data for navigation event that was delayed.
		_this.cachedNavigation = null;

		// Cache for unblock function returned by history.block
		_this.historyUnblock = null;

		// Cache the active handler function so can compare between renders
		_this.handler = null;

		// Bind blocking method plus all handler API-object methods
		bindAll(_this, ['beforeRouteChange', 'isPaused', 'pausedLocation', 'resume', 'cancel', 'push', 'replace']);
		return _this;
	}

	babelHelpers.createClass(ReactRouterPause, [{
		key: 'componentDidMount',
		value: function componentDidMount() {
			// Same processes run on EVERY render
			this.componentDidUpdate();
		}

		// noinspection JSCheckFunctionSignatures

	}, {
		key: 'componentDidUpdate',
		value: function componentDidUpdate() {
			// Update config on every load in case something changes
			var config = this.props.config || {};
			this.config = Object.assign({}, defaultConfig, config);

			// Update handler and blocking status on every render
			this.updateBlocking();
		}
	}, {
		key: 'componentWillUnmount',
		value: function componentWillUnmount() {
			this.unblock();
		}

		/**
   * Check props to see if need to change any blocking configuration.
   * NOTE: This method must be efficient as called after every key-stroke!
   */

	}, {
		key: 'updateBlocking',
		value: function updateBlocking() {
			// Abort early if possible
			if (this.props.when === false) {
				this.unblock();
				return;
			}

			var prev = this.handler;
			var next = this.props.handler;
			// Ensure param is a function
			if (next && !isFunction(next)) next = null;

			// Allow blocking handler to be changed on each render
			// MAY TRIGGER ON EVERY RENDER if 'handler' callback is recreated each
			// time Using a 'named function' will avoid this; see isSameFunction()
			if (!prev && !next) ; else if (prev && !next) {
				this.unblock();
			} else if (next && !prev) {
				this.block();
			} else if (!isSameFunction(next, prev)) {
				this.block();
			}
		}
	}, {
		key: 'block',
		value: function block() {
			var _props = this.props,
			    handler = _props.handler,
			    history = _props.history;

			// Unbind current blocker, if set

			this.unblock();

			this.handler = handler;

			// Call history.block with listener to fire BEFORE a route-change.
			// The return value is method for unbinding the block listener.
			this.historyUnblock = history.block(this.beforeRouteChange);
		}
	}, {
		key: 'unblock',
		value: function unblock() {
			var fn = this.historyUnblock;
			this.historyUnblock = null;
			this.handler = null;
			if (fn) fn();
		}

		/**
   * Was a handler method passed in to the component?
   * @returns {boolean}
   */

	}, {
		key: 'isBlocking',
		value: function isBlocking() {
			return !!this.historyUnblock;
		}

		/**
   * Set or clear flag used for skipping the next navigation event.
   * @param {boolean} enable
   */

	}, {
		key: 'allowNextEvent',
		value: function allowNextEvent(enable) {
			this.ignoreNextNavigationEvent = !!enable;
		}

		/**
   * Is there currently a location cached that we can 'resume'?
   * @returns {(Object|null)}
   */

	}, {
		key: 'pausedLocation',
		value: function pausedLocation() {
			var route = this.cachedNavigation;
			/** @namespace route.location **/
			return route ? cloneDeep(route.location) : null;
		}

		/**
   * Clear the cached location
   */

	}, {
		key: 'clearCache',
		value: function clearCache() {
			this.cachedNavigation = null;
		}

		/**
   * Is there currently a location cached that we can 'resume'?
   * @returns {boolean}
   */

	}, {
		key: 'isPaused',
		value: function isPaused() {
			return !!this.cachedNavigation;
		}

		/**
   * Resume previously cachedNavigation blocked by handler callback.
   */

	}, {
		key: 'resume',
		value: function resume() {
			if (!this.isPaused()) return;

			var history = this.props.history;
			var _cachedNavigation = this.cachedNavigation,
			    location = _cachedNavigation.location,
			    action = _cachedNavigation.action;

			action = action.toLowerCase();
			this.clearCache();

			// Avoid blocking the next event
			this.allowNextEvent(true);

			// NOTE: Impossible to handle multi-page-back programmatically
			// There is not history.pop() method, only history.go(-n), but it is
			//	not possible to lookup passed "location.key" uid in history stack!
			if (action === 'pop') {
				// Most of the time a POP is only a single page back, so do that.
				// This handles confirmation. User can THEN go-back more pages.
				history.goBack();
			} else {
				// action === 'push' || 'replace'
				history[action](location);
			}
		}

		/**
   * Clear cached navigation/location data so cannot be used
   */

	}, {
		key: 'cancel',
		value: function cancel() {
			this.clearCache();
		}

		/**
   * @param {(string|Object)} pathOrLocation
   * @param {Object} [state]
   */

	}, {
		key: 'push',
		value: function push(pathOrLocation, state) {
			this.clearCache();
			this.allowNextEvent(true); // Avoid blocking this event
			this.props.history.push(pathOrLocation, state);
		}

		/**
   * @param {(string|Object)} pathOrLocation
   * @param {Object} [state]
   */

	}, {
		key: 'replace',
		value: function replace(pathOrLocation, state) {
			this.clearCache();
			this.allowNextEvent(true); // Avoid blocking this event
			this.props.history.replace(pathOrLocation, state);
		}

		/**
   * @param {object} location
   * @param {string} action
   * @returns {boolean}
   */

	}, {
		key: 'askHandler',
		value: function askHandler(location, action) {
			var _this2 = this;

			var resp = true;
			var pauseCalled = false;

			// Cache route info so can resume route later
			this.cachedNavigation = { location: location, action: action };

			var navigationAPI = pick(this, ['isPaused', // Returns true or false
			'pausedLocation', // Returns location-object or null
			'resume', 'cancel', 'push', 'replace']);
			// Add SYNCHRONOUS pause method to API
			// Allows 'pause' to be set via an API call instead of returning null
			navigationAPI.pause = function () {
				pauseCalled = true;
			};

			// Prevent a component-level error from breaking router navigation
			try {
				resp = this.handler(navigationAPI, location, action);
			} catch (err) {} // eslint-disable-line

			// If pausedLocation is empty, an api method must have been called
			if (!this.isPaused()) {
				return false;
			}

			// If navigation.pause() was called, THIS TAKES PRECEDENT
			if (pauseCalled) {
				resp = null;
			}

			// A Null response means pause/delay navigation
			if (isNull(resp)) {
				return false;
			}

			// A Promise response means pause/delay navigation
			// Promise will resume navigation if resolved; cancel if rejected
			if (isPromise(resp)) {
				// noinspection JSUnresolvedFunction,JSObjectNullOrUndefined
				resp.then(function (val) {
					if (val === false) _this2.cancel();else _this2.resume();
				}).catch(this.cancel);

				return false;
			}

			// NOT PAUSED, so clear the cached location
			this.clearCache();

			if (resp === false) {
				return false;
			}
			if (resp === true || isUndefined(resp)) {
				return true;
			}

			// Log warning if an invalid response received, including undefined
			console.error('Invalid response from ReactRouterPause.handler: `' + resp + '`. ' + '\nResponse should be one of: true, false, null, undefined, Promise');

			return true;
		}

		/**
   * Listener for history.block - fires BEFORE a route-change.
   *
   * @param {Object} location        Object with location, hash, etc.
   * @param {string} action       One of [PUSH|REPLACE|POP]
   */

	}, {
		key: 'beforeRouteChange',
		value: function beforeRouteChange(location, action) {
			var props = this.props,
			    config = this.config;

			var prevLocation = props.history.location;

			// Use fingerprints to easily comparison new to previous location
			var pageChanged = fingerprint(location) !== fingerprint(prevLocation);
			// Bookmarks are NOT included in the location fingerprint
			var hashChanged = location.hash !== prevLocation.hash;

			// Block navigation if is the SAME LOCATION we are already at!
			// This prevents reloading a form and losing its contents.
			if (!pageChanged && !hashChanged) {
				return false;
			} else if (this.ignoreNextNavigationEvent) {
				this.allowNextEvent(false); // Reset one-time flag
				return true;
			}
			// If ONLY a hash/bookmark change AND config.allowBookmarks, allow it
			else if (!pageChanged && config.allowBookmarks) {
					return true;
				} else if (this.isBlocking()) {
					// The this.askHandler method handles the pause/resume functionality.
					// Call the handler to see if we should allow route change (true).
					// Coerce response to a boolean because that's what RR expects.
					var resp = !!this.askHandler(location, action);

					// There are only 3 responses that block navigation
					if (resp === false || isNull(resp) || isPromise(resp)) {
						return false;
					}
				}

			// Allow anything not handled above
			return true;
		}
	}, {
		key: 'render',
		value: function render() {
			return null;
		}
	}]);
	return ReactRouterPause;
}(React.Component);

var bool = PropTypes.bool,
    func = PropTypes.func,
    object = PropTypes.object,
    shape = PropTypes.shape,
    string = PropTypes.string;


ReactRouterPause.propTypes = {
	history: shape({
		location: shape({
			pathname: string,
			search: string,
			hash: string,
			state: object
		}),
		block: func,
		goBack: func,
		push: func,
		replace: func
	}).isRequired,
	handler: func,
	when: bool,
	config: shape({
		allowBookmarks: bool
	})
};

var ReactRouterPause$1 = withRouter(ReactRouterPause);

// ReactRouterPauseHooks NOT exported by index.js - for testing only!

export default ReactRouterPause$1;
