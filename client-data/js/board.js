/**
 *                        WHITEBOPHIR
 *********************************************************
 * @licstart  The following is the entire license notice for the
 *  JavaScript code in this page.
 *
 * Copyright (C) 2013  Ophir LOJKINE
 *
 *
 * The JavaScript code in this page is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License (GNU GPL) as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.  The code is distributed WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
 *
 * As additional permission under GNU GPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * @licend
 */
let Tools = {};

Tools.i18n = (function i18n() {
	let translations = JSON.parse(document.getElementById("translations").text);
	return {
		"t": function translate(s) {
			let key = s.toLowerCase().replace(/ /g, '_');
			return translations[key] || s;
		}
	};
})();

Tools.server_config = JSON.parse(document.getElementById("configuration").text);

Tools.board = document.getElementById("board");
Tools.svg = document.getElementById("canvas");
Tools.drawingArea = Tools.svg.getElementById("drawingArea");

//Initialization
Tools.curTool = null;
Tools.drawingEvent = true;
Tools.showMarker = false;
Tools.showOtherCursors = true;
Tools.showMyCursor = false;

Tools.isIE = /MSIE|Trident/.test(window.navigator.userAgent);

Tools.socket = null;
Tools.connect = function () {
	let self = this;

	// Destroy socket if one already exists
	if (self.socket) {
		self.socket.destroy();
		delete self.socket;
		self.socket = null;
	}

	this.socket = io.connect('', {
		"path": window.location.pathname.split("/boards/")[0] + "/socket.io",
		"reconnection": true,
		"reconnectionDelay": 100, //Make the xhr connections as fast as possible
		"timeout": 1000 * 60 * 20 // Timeout after 20 minutes
	});

	//Receive draw instructions from the server
	this.socket.on("broadcast", function (msg) {
		handleMessage(msg).finally(function afterload() {
			let loadingEl = document.getElementById("loadingMessage");
			loadingEl.classList.add("hidden");
		});
	});



	this.socket.on("reconnect", function onReconnection() {
		Tools.socket.emit('joinboard', Tools.boardName);
	});
};

Tools.connect();

Tools.boardName = (function () {
	let path = window.location.pathname.split("/");
	return decodeURIComponent(path[path.length - 1]);
})();

//Get the board as soon as the page is loaded
Tools.socket.emit("getboard", Tools.boardName);

Tools.HTML = {

	addTool: function (toolName, toolIcon, toolIconHTML, toolShortcut, oneTouch) {
		if(toolName === "Zoom" || toolName === "zoom") {
			console.log('error ocupies here!');
		}
		let toolOpenedFromClick = false;
		const toolEl = document.getElementById('Tool-' + toolName);
		const toolParentEl = document.getElementById('Tool-' + toolName).parentElement;
		const subTools = toolParentEl.getElementsByClassName('sub-tool-item');

		const onClick = function (e) {
			console.log('onClick');
			Tools.change(toolName, toolEl.dataset.index);
			toolOpenedFromClick = true;
			toolParentEl.classList.add('opened');
			e.stopPropagation();
			document.addEventListener('touchstart', closeFromClick, { once: true });
		};

		const closeFromClick = function (e) {
			for (let el of e.composedPath()) {
				if (el && el.classList && el.classList.contains('sub-tool-item')) return;
				if (el && el.id === 'Tool-' + toolName) return;
			}
			toolOpenedFromClick = false;
			console.log('closeFromClick');
			setTimeout(function () { toolParentEl.classList.remove('opened') }, 100);
		};

		const onMouseEnter = function (e) {
			console.log('onmouseenter');
			toolParentEl.classList.add('opened');
		};

		const onMouseLeave = function (e) {
			console.log('onmouseleave');
			if (!toolOpenedFromClick) toolParentEl.classList.remove('opened');
		};
		// Some Work Here
		const subToolClick = function (e) {
			console.log('SubTool click');
			const subTool = e.composedPath().find(function (item) {
				return item.classList.contains('sub-tool-item');
			});
			Tools.change(toolName, subTool.dataset.index);
			toolParentEl.classList.remove('opened');
		};


		for (let subTool of subTools) {
			subTool.addEventListener('click', subToolClick);
		}

		//Tools.change(toolName);

		toolEl.addEventListener('click', function () {
			Tools.change(toolName, toolEl.dataset.index);
		});
		toolEl.addEventListener("touchstart", onClick);
		toolParentEl.addEventListener('mouseenter', onMouseEnter);
		toolParentEl.addEventListener('mouseleave', onMouseLeave);
	},
	changeTool: function (oldToolName, newToolName) {
		let oldTool = document.getElementById("Tool-" + oldToolName);
		newTool = document.getElementById("Tool-" + newToolName);

		if (oldTool) oldTool.classList.remove("selected-tool");
		if (newTool) newTool.classList.add("selected-tool");
	},
	toggle: function (toolName) {
		let elem = document.getElementById("Tool-" + toolName);
		elem.classList.add('selected-tool');
	},
	addStylesheet: function (href) {
		//Adds a css stylesheet to the html or svg document
		let link = document.createElement("link");
		link.href = href;
		link.rel = "stylesheet";
		link.type = "text/css";
		document.head.appendChild(link);
	},
};

Tools.list = {}; // An array of all known tools. {"toolName" : {toolObject}}

Tools.isBlocked = function toolIsBanned(tool) {
	if (tool.name.includes(",")) throw new Error("Tool Names must not contain a comma");
	return Tools.server_config.BLOCKED_TOOLS.includes(tool.name);
};

/**
 * Register a new tool, without touching the User Interface
 */
Tools.register = function registerTool(newTool) {
	if (Tools.isBlocked(newTool)) return;

	if (newTool.name in Tools.list) {
		console.log("Tools.add: The tool '" + newTool.name + "' is already" +
			"in the list. Updating it...");
	}

	//Format the new tool correctly
	Tools.applyHooks(Tools.toolHooks, newTool);

	//Add the tool to the list
	Tools.list[newTool.name] = newTool;

	// Register the change handlers
	if (newTool.onSizeChange) Tools.sizeChangeHandlers.push(newTool.onSizeChange);

	//There may be pending messages for the tool
	let pending = Tools.pendingMessages[newTool.name];
	if (pending) {
		console.log("Drawing pending messages for '%s'.", newTool.name);
		let msg;
		while (msg = pending.shift()) {
			//Transmit the message to the tool (precising that it comes from the network)
			newTool.draw(msg, false);
		}
	}
};

Tools.isMobile = function () {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Add a new tool to the user interface
 */
Tools.add = function (newTool) {
	if (Tools.isBlocked(newTool)) return;

	Tools.register(newTool);

	if (newTool.stylesheet) {
		Tools.HTML.addStylesheet(newTool.stylesheet);
	}

	//Add the tool to the GUI
	Tools.HTML.addTool(newTool.name, newTool.icon, newTool.iconHTML, newTool.shortcut, newTool.oneTouch);
};

Tools.change = function (toolName, subToolIndex) {
	let newTool = Tools.list[toolName];
	let oldTool = Tools.curTool;
	console.log(toolName);
	console.log(subToolIndex);
	const toolEl = document.getElementById('Tool-' + toolName);
	if (toolEl.classList) {
		toolEl.classList.remove('fix');
		toolEl.classList.remove('dash');
		toolEl.classList.remove('shape');
	}
	toolElParent = toolEl.parentElement;
	for (let item of toolElParent.getElementsByClassName('sub-tool-item')) {
		if (item.dataset.index == subToolIndex) {
			toolEl.innerHTML = item.innerHTML;
			if (item.classList.contains('fix')) toolEl.classList.add('fix');
			if (item.classList.contains('dash')) toolEl.classList.add('dash');
			if (item.classList.contains('shape')) toolEl.classList.add('shape');
			item.classList.add('selected-tool');
		} else {
			item.classList.remove('selected-tool');
		}
	}
	if (newTool.setIndex) {
		toolEl.dataset.index = +subToolIndex || 0;
		newTool.setIndex(subToolIndex);
	}
	if (!newTool) throw new Error("Trying to select a tool that has never been added!");
	if (newTool === oldTool) {
		if (newTool.secondary) {
			newTool.secondary.active = !newTool.secondary.active;
			let props = newTool.secondary.active ? newTool.secondary : newTool;
			Tools.HTML.toggle(newTool.name, props.name, props.icon);
			if (newTool.secondary.switch) newTool.secondary.switch();
		}
		return;
	}
	if (!newTool.oneTouch) {
		//Update the GUI
		let curToolName = (Tools.curTool) ? Tools.curTool.name : "";
		try {
			Tools.HTML.changeTool(curToolName, toolName);
		} catch (e) {
			console.error("Unable to update the GUI with the new tool. " + e);
		}
		Tools.svg.style.cursor = newTool.mouseCursor || "auto";
		Tools.board.title = Tools.i18n.t(newTool.helpText || "");

		//There is not necessarily already a curTool
		if (Tools.curTool !== null) {
			//It's useless to do anything if the new tool is already selected
			if (newTool === Tools.curTool) return;

			//Remove the old event listeners
			Tools.removeToolListeners(Tools.curTool);

			//Call the callbacks of the old tool
			Tools.curTool.onquit(newTool);
		}

		//Add the new event listeners
		Tools.addToolListeners(newTool);
		Tools.curTool = newTool;
	}

	//Call the start callback of the new tool
	newTool.onstart(oldTool);
};

Tools.addToolListeners = function addToolListeners(tool) {
	for (let event in tool.compiledListeners) {
		let listener = tool.compiledListeners[event];
		let target = listener.target || Tools.board;
		target.addEventListener(event, listener, { 'passive': false });
	}
};

Tools.removeToolListeners = function removeToolListeners(tool) {
	for (let event in tool.compiledListeners) {
		let listener = tool.compiledListeners[event];
		let target = listener.target || Tools.board;
		target.removeEventListener(event, listener);
		// also attempt to remove with capture = true in IE
		if (Tools.isIE) target.removeEventListener(event, listener, true);
	}
};

(function () {
	// Handle secondary tool switch with shift (key code 16)
	function handleShift(active, evt) {
		// list tools for ignore handle shift
		const toolsIgnore = ["Straight line", "Pencil"];
		if (!toolsIgnore.includes(Tools.curTool.name) && evt.keyCode === 16 && Tools.curTool.secondary && Tools.curTool.secondary.active !== active) {
			Tools.change(Tools.curTool.name);
		}
	}
	window.addEventListener("keydown", handleShift.bind(null, true));
	window.addEventListener("keyup", handleShift.bind(null, false));
})();

Tools.send = function (data, toolName) {
	toolName = toolName || Tools.curTool.name;
	let d = data;
	d.tool = toolName;
	Tools.applyHooks(Tools.messageHooks, d);
	let message = {
		"board": Tools.boardName,
		"data": d
	};
	Tools.socket.emit('broadcast', message);
};

Tools.drawAndSend = function (data, tool) {
	////////////////////////////////////////////
	if (tool == null) tool = Tools.curTool;
	tool.draw(data, true);
	Tools.send(data, tool.name);
};

//Object containing the messages that have been received before the corresponding tool
//is loaded. keys : the name of the tool, values : array of messages for this tool
Tools.pendingMessages = {};

// Send a message to the corresponding tool
function messageForTool(message) {
	let name = message.tool,
		tool = Tools.list[name];

	if (tool) {
		Tools.applyHooks(Tools.messageHooks, message);
		tool.draw(message, false);
	} else {
		///We received a message destinated to a tool that we don't have
		//So we add it to the pending messages
		if (!Tools.pendingMessages[name]) Tools.pendingMessages[name] = [message];
		else Tools.pendingMessages[name].push(message);
	}

	if (message.tool !== 'Hand' && message.transform != null) {
		//this message has special info for the mover
		messageForTool({ tool: 'Hand', type: 'update', transform: message.transform, id: message.id });
	}
}

// Apply the function to all arguments by batches
function batchCall(fn, args) {
	let BATCH_SIZE = 1024;
	if (args.length === 0) {
		return Promise.resolve();
	} else {
		let batch = args.slice(0, BATCH_SIZE);
		let rest = args.slice(BATCH_SIZE);
		return Promise.all(batch.map(fn))
			.then(function () {
				return new Promise(requestAnimationFrame);
			}).then(batchCall.bind(null, fn, rest));
	}
}

// Call messageForTool recursively on the message and its children
function handleMessage(message) {
	//Check if the message is in the expected format
	if (!message.tool && !message._children) {
		console.error("Received a badly formatted message (no tool). ", message);
	}
	if (message.userCount) updateUserCount(message.userCount);
	if (message.tool) messageForTool(message);
	if (message._children) return batchCall(handleMessage, message._children);
	else return Promise.resolve();
}

function updateUserCount(userCount) {
	document.getElementById("usercount").textContent = userCount;
};

Tools.unreadMessagesCount = 0;
Tools.newUnreadMessage = function () {
	Tools.unreadMessagesCount++;
	updateDocumentTitle();
};

window.addEventListener("focus", function () {
	Tools.unreadMessagesCount = 0;
	updateDocumentTitle();
});

function updateDocumentTitle() {
	document.title =
		(Tools.unreadMessagesCount ? '(' + Tools.unreadMessagesCount + ') ' : '') +
		Tools.boardName +
		" | WBO";
}

(function () {
	// Scroll and hash handling
	let scrollTimeout, lastStateUpdate = Date.now();

	window.addEventListener("scroll", function onScroll() {
		let scale = Tools.getScale();
		let x = document.documentElement.scrollLeft / scale,
			y = document.documentElement.scrollTop / scale;

		clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(function updateHistory() {
			let hash = '#' + (x | 0) + ',' + (y | 0) + ',' + Tools.getScale().toFixed(1);
			if (Date.now() - lastStateUpdate > 5000 && hash !== window.location.hash) {
				window.history.pushState({}, "", hash);
				lastStateUpdate = Date.now();
			} else {
				window.history.replaceState({}, "", hash);
			}
		}, 100);
	});

	function setScrollFromHash() {
		let coords = window.location.hash.slice(1).split(',');
		let x = coords[0] | 0;
		let y = coords[1] | 0;
		let scale = parseFloat(coords[2]);
		resizeCanvas({ x: x, y: y });
		Tools.setScale(scale);
		window.scrollTo(x * scale, y * scale);
	}

	function scaleToCenter(origin, scale) {
		const defaultScale = 1;
		let oldScale = origin.scale;
		let newScale = Tools.setScale(scale);
		window.scrollTo(
			origin.scrollX + origin.x * (newScale - oldScale),
			origin.scrollY + origin.y * (newScale - oldScale)
		);
		scaleToCenter(defaultOrigin, defaultScale);

		const defaultOrigin = {
			scrollX: document.documentElement.scrollLeft,
			scrollY: document.documentElement.scrollTop,
			x: 0.0,
			y: 0.0,
			clientY: 0,
			scale: 1.0
		}
	}

	function scaleToFull() {
		Tools.setScale(1);
	}

	function minusScale() {
		Tools.setScale(Tools.getScale() - 0.1);
	}

	function plusScale() {
		Tools.setScale(Tools.getScale() + 0.1);
	}


	function sendClearBoard() {
		const needClear = confirm('Are you sure?');
		if (needClear) {
			Tools.drawAndSend({
				'type': 'clearBoard',
			}, Tools.list.Eraser);
		}
	}

	function showBoard() {
		if (Tools.server_config.FEATURES_CURSORS) {
			Tools.showMarker = true;
		}
	}

	function checkBoard() {
		showBoard();
		return;
	}

	document.getElementById('scalingCenter').addEventListener('click', scaleToCenter, false);
	document.getElementById('scalingFull').addEventListener('click', scaleToFull, false);
	document.getElementById('minusScale').addEventListener('click', minusScale, false);
	document.getElementById('plusScale').addEventListener('click', plusScale, false);
	document.getElementById('clearBoard').addEventListener('click', sendClearBoard, false);

	window.addEventListener("hashchange", setScrollFromHash, false);
	window.addEventListener("popstate", setScrollFromHash, false);
	window.addEventListener("DOMContentLoaded", setScrollFromHash, false);
	window.addEventListener("DOMContentLoaded", checkBoard, false);
})();

function resizeCanvas(m) {
	//Enlarge the canvas whenever something is drawn near its border
	let x = m.x | 0, y = m.y | 0
	let MAX_BOARD_SIZE = Tools.server_config.MAX_BOARD_SIZE || 65536; // Maximum value for any x or y on the board
	if (x > Tools.svg.width.baseVal.value - 2000) {
		Tools.svg.width.baseVal.value = Math.min(x + 2000, MAX_BOARD_SIZE);
	}
	if (y > Tools.svg.height.baseVal.value - 2000) {
		Tools.svg.height.baseVal.value = Math.min(y + 2000, MAX_BOARD_SIZE);
	}
}

function updateUnreadCount(m) {
	if (document.hidden && ["child", "update"].indexOf(m.type) === -1) {
		Tools.newUnreadMessage();
	}
}

// List of hook functions that will be applied to messages before sending or drawing them
Tools.messageHooks = [resizeCanvas, updateUnreadCount];

Tools.scale = 1.0;
let scaleTimeout = null;
Tools.setScale = function setScale(scale) {
	let fullScale = Math.max(window.innerWidth, window.innerHeight) / Tools.server_config.MAX_BOARD_SIZE;
	let minScale = Math.max(0.67, fullScale);
	let maxScale = 2;
	if (isNaN(scale)) scale = 1;
	scale = Math.max(minScale, Math.min(maxScale, scale));
	Tools.svg.style.willChange = 'transform';
	Tools.svg.style.transform = 'scale(' + scale + ')';
	clearTimeout(scaleTimeout);
	scaleTimeout = setTimeout(function () {
		Tools.svg.style.willChange = 'auto';
	}, 1000);
	Tools.scale = scale;
	document.getElementById('scaleValue').innerText = Math.round(scale * 100) + '%';
	return scale;
}
Tools.getScale = function getScale() {
	return Tools.scale;
}

//List of hook functions that will be applied to tools before adding them
Tools.toolHooks = [
	function checkToolAttributes(tool) {
		if (typeof (tool.name) !== "string") throw "A tool must have a name";
		if (typeof (tool.listeners) !== "object") {
			tool.listeners = {};
		}
		if (typeof (tool.onstart) !== "function") {
			tool.onstart = function () { };
		}
		if (typeof (tool.onquit) !== "function") {
			tool.onquit = function () { };
		}
	},
	function compileListeners(tool) {
		//compile listeners into compiledListeners
		let listeners = tool.listeners;

		//A tool may provide precompiled listeners
		let compiled = tool.compiledListeners || {};
		tool.compiledListeners = compiled;

		function compile(listener) { //closure
			return (function listen(evt) {
				let x = evt.pageX / Tools.getScale(),
					y = evt.pageY / Tools.getScale();
				return listener(x, y, evt, false);
			});
		}

		function compileTouch(listener) { //closure
			return (function touchListen(evt) {
				//Currently, we don't handle multitouch
				if (evt.changedTouches.length === 1) {
					//evt.preventDefault();
					let touch = evt.changedTouches[0];
					let x = touch.pageX / Tools.getScale(),
						y = touch.pageY / Tools.getScale();
					return listener(x, y, evt, true);
				}
				return true;
			});
		}

		function wrapUnsetHover(f, toolName) {
			return (function unsetHover(evt) {
				document.activeElement && document.activeElement.blur && document.activeElement.blur();
				return f(evt);
			});
		}

		if (listeners.press) {
			compiled["mousedown"] = wrapUnsetHover(compile(listeners.press), tool.name);
			compiled["touchstart"] = wrapUnsetHover(compileTouch(listeners.press), tool.name);
		}
		if (listeners.move) {
			compiled["mousemove"] = compile(listeners.move);
			compiled["touchmove"] = compileTouch(listeners.move);
		}
		if (listeners.release) {
			let release = compile(listeners.release),
				releaseTouch = compileTouch(listeners.release);
			compiled["mouseup"] = release;
			if (!Tools.isIE) compiled["mouseleave"] = release;
			compiled["touchleave"] = releaseTouch;
			compiled["touchend"] = releaseTouch;
			compiled["touchcancel"] = releaseTouch;
		}
	}
];

Tools.applyHooks = function (hooks, object) {
	//Apply every hooks on the object
	hooks.forEach(function (hook) {
		hook(object);
	});
};


// Utility functions

Tools.generateUID = function (prefix, suffix) {
	var uid = Date.now().toString(36); //Create the uids in chronological order
	uid += (Math.round(Math.random() * 36)).toString(36); //Add a random character at the end
	if (prefix) uid = prefix + uid;
	if (suffix) uid = uid + suffix;
	return uid;
};

Tools.createSVGElement = function createSVGElement(name, attrs) {
	let elem = document.createElementNS(Tools.svg.namespaceURI, name);
	if (typeof (attrs) !== "object") return elem;
	Object.keys(attrs).forEach(function (key, i) {
		elem.setAttributeNS(null, key, attrs[key]);
	});
	return elem;
};

Tools.positionElement = function (elem, x, y) {
	elem.style.top = y + "px";
	elem.style.left = x + "px";
};

Tools.color_chooser = document.getElementById("color-picker");
Tools.current_color = document.getElementById('current-color');

document.getElementById('color-picker').addEventListener("change", watchColorPicker, false);
Tools.targets = null;

Tools.setDrawColor = function (color) {
	Tools.color_chooser.value = color;
	const presetsList = document.getElementsByClassName('color-preset-box');

	for (var node of presetsList) {
		node.classList.remove('selected-color');
	}
	const colorEl = document.querySelector('.color' + color.substring(1));
	if (colorEl) {
		colorEl.parentNode.classList.add('selected-color');
	}
}

Tools.setColor = function (color) {
	Tools.setDrawColor(color);

	if (Tools.targets) {
		Tools.targets.forEach((elem) => {
			elem.setAttribute('stroke', color);
		})
		colorUpdate(Tools.targets);
	}
};

Tools.getColor = (function color() {
	return function () {
		return Tools.color_chooser.value;
	};
})();

function colorUpdate(data) {
	for (let elem of data) {
		let msg = {
			"type": 'update',
			"id": elem.id,
			"color": elem.getAttribute('stroke')
		}
		Tools.drawAndSend(msg, Tools.list.Transform);
	}
}

function watchColorPicker(e) {
	// e.target.value
	colorMouseLeaveClose = true;
	const presetsList = document.getElementsByClassName('color-preset-box');
	for (var node of presetsList) {
		node.classList.remove('selected-color');
	}
	presetsList[0].classList.add('selected-color');

	if (Tools.targets) {
		Tools.targets.forEach((elem) => {
			elem.setAttribute('stroke', e.target.value);
		})
		colorUpdate(Tools.targets);
	}
}

document.getElementById('color-picker-btn').addEventListener('pointerdown', function (e) {
	colorMouseLeaveClose = false;
	colorMouseLeaveClose = false;
	e.stopPropagation();
	document.addEventListener('pointerdown', function () {
		toolColorEl.classList.remove('opened');
	}, { once: true });
});

var colorMouseLeaveClose = true;

const toolColorEl = document.getElementById('color-tool');

toolColorEl.addEventListener('mouseenter', function () {
	toolColorEl.classList.add('opened');
});
toolColorEl.addEventListener('mouseleave', function () {
	if (!colorMouseLeaveClose) return;
	toolColorEl.classList.remove('opened');
});
toolColorEl.addEventListener('touchstart', function (e) {
	e.stopPropagation();
	document.getElementById('Tool-' + Tools.curTool.name).parentElement.classList.remove('opened');
	document.addEventListener('touchstart', function (e) {
		toolColorEl.classList.remove('opened');
	}, { once: true });
	toolColorEl.classList.add('opened');
});

for (var colorPreset of document.getElementsByClassName('color-preset')) {
	colorPreset.addEventListener('click', function (e) {
		if (e.target.tagName === 'DIV') {
			const presetsList = document.getElementsByClassName('color-preset-box');
			Tools.setColor(e.target.getAttribute('style').replace('background-color: ', '').replace(';', ''));
			for (var node of presetsList) {
				node.classList.remove('selected-color');
			}
			e.composedPath()[1].classList.add('selected-color');
			document.getElementById('color-tool').classList.remove('opened');
		}
	});
}


Tools.setFontSize = (function () {
	const fontSizeValueEl = document.getElementById('fontSize-value');
	let fontSize = 32;

	document.getElementById('fontSize-up').addEventListener('pointerdown', function () {
		Tools.setFontSize(Tools.getFontSize() + 1);
	});

	document.getElementById('fontSize-down').addEventListener('pointerdown', function () {
		Tools.setFontSize(Tools.getFontSize() - 1);
	});

	return function (newFontSize) {
		if (newFontSize) {
			fontSize = newFontSize;
			fontSizeValueEl.innerText = newFontSize;
			Tools.list.Text.changeHandler();
		}
		return fontSize;
	}
})();

Tools.getFontSize = function () {
	return Tools.setFontSize();
}

Tools.getFontStyles = (function () {
	const fontSelectEl = document.getElementById('text-settings-select');
	const fontValueEl = document.getElementById('text-settings-value');
	fontSelectEl.addEventListener('pointerdown', function () {
		fontSelectEl.classList.toggle('text-settings-select-opened');
	});

	for (let listItemEl of document.getElementsByClassName('text-settings-list-item')) {
		listItemEl.addEventListener('pointerdown', function (e) {
			fontValueEl.setAttribute('style', e.target.getAttribute('style'));
			fontValueEl.innerText = e.target.innerText;
			Tools.list.Text.changeHandler();
		});
	}

	return function () {
		return fontValueEl.getAttribute('style');
	}
})();

Tools.sizeChangeHandlers = [];
Tools.setSize = (function size() {
	const chooser = document.getElementById("width-range");
	const sizeListElement = document.getElementById('width-list');
	const listAllItems = document.getElementsByClassName('width-item');
	let currentToolWidth = document.querySelector('.main-tool-width');
	sizeListElement.addEventListener('click', function (evt) {
		evt.stopPropagation();
		if (evt.target.classList.contains('width-item')) {
			for (let item of listAllItems) {
				item.classList.remove('selected-width');
			}
			evt.composedPath()[0].classList.add('selected-width');
			Tools.setSize(+evt.target.innerText);
			currentToolWidth.innerHTML = chooser.value;
		}
	});

	function update() {
		let size = Math.max(1, Math.min(60, chooser.value | 0));
		chooser.value = size;
		currentToolWidth.innerHTML = chooser.value;
		for (let item of listAllItems) {
			item.classList.remove('selected-width');
			if (item.innerText == size) {
				item.classList.add('selected-width');
			}
		}
		Tools.sizeChangeHandlers.forEach(function (handler) {
			handler(size);
		});
	}

	update();
	chooser.onchange = chooser.oninput = update;
	return function (value) {
		if (value !== null && value !== undefined) {
			chooser.value = value;
			update();
		}
		return parseInt(chooser.value);
	};
})();

const toolWidthEl = document.getElementById('width-tool');

toolWidthEl.addEventListener('mouseenter', function () {
	toolWidthEl.classList.add('opened');
});

toolWidthEl.addEventListener('mouseleave', function () {
	toolWidthEl.classList.remove('opened');
});
toolWidthEl.addEventListener('touchstart', function (e) {
	e.stopPropagation();
	document.getElementById('Tool-' + Tools.curTool.name).parentElement.classList.remove('opened');
	document.addEventListener('touchstart', function (e) {
		toolWidthEl.classList.remove('opened');
	}, { once: true });
	toolWidthEl.classList.add('opened');
});

Tools.getSize = (function () {
	return Tools.setSize()
});

Tools.getOpacity = function () {
	return 1;
}

//Scale the canvas on load
Tools.svg.width.baseVal.value = document.body.clientWidth;
Tools.svg.height.baseVal.value = document.body.clientHeight;

/**
 What does a "tool" object look like?
 newtool = {
	  "name" : "SuperTool",
	  "listeners" : {
			"press" : function(x,y,evt){...},
			"move" : function(x,y,evt){...},
			"release" : function(x,y,evt){...},
	  },
	  "draw" : function(data, isLocal){
			//Print the data on Tools.svg
	  },
	  "onstart" : function(oldTool){...},
	  "onquit" : function(newTool){...},
	  "stylesheet" : "style.css",
}
*/