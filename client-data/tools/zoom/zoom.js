(function () { //Code isolation
    var ZOOM_FACTOR = .5;
    var origin = {
        scrollX: document.documentElement.scrollLeft,
        scrollY: document.documentElement.scrollTop,
        x: 0.0,
        y: 0.0,
        clientY: 0,
        scale: 1.0
    };
    var moved = false, pressed = false;

    function zoom(origin, scale) {
        var oldScale = origin.scale;
        var newScale = Tools.setScale(scale);
        window.scrollTo(
            origin.scrollX + origin.x * (newScale - oldScale),
            origin.scrollY + origin.y * (newScale - oldScale)
        );
    }

    var animation = null;
    function animate(scale) {
        cancelAnimationFrame(animation);
        animation = requestAnimationFrame(function () {
            zoom(origin, scale);
        });
    }

    function setOrigin(x, y, evt, isTouchEvent) {
        origin.scrollX = document.documentElement.scrollLeft;
        origin.scrollY = document.documentElement.scrollTop;
        origin.x = x;
        origin.y = y;
        origin.clientY = getClientY(evt, isTouchEvent);
        origin.scale = Tools.getScale();
    }

    function press(x, y, evt, isTouchEvent) {
        evt.preventDefault();
        setOrigin(x, y, evt, isTouchEvent);
        moved = false;
        pressed = true;
    }

    function move(x, y, evt, isTouchEvent) {
        if (pressed) {
            evt.preventDefault();
            var delta = getClientY(evt, isTouchEvent) - origin.clientY;
            var scale = origin.scale * (1 + delta * ZOOM_FACTOR / 100);
            if (Math.abs(delta) > 1) moved = true;
            animation = animate(scale);
        }
    }

    function onwheel(evt) {
        evt.preventDefault();
        var multiplier =
            (evt.deltaMode === WheelEvent.DOM_DELTA_LINE) ? 30 :
                (evt.deltaMode === WheelEvent.DOM_DELTA_PAGE) ? 1000 :
                    1;
        var deltaX = evt.deltaX * multiplier, deltaY = evt.deltaY * multiplier;
        if (evt.ctrlKey || Tools.curTool === zoomTool) {
            // zoom
            var scale = Tools.getScale();
            var x = evt.pageX / scale;
            var y = evt.pageY / scale;
            setOrigin(x, y, evt, false);
            animate((1 - deltaY / 800) * Tools.getScale());
        } else if (evt.altKey) {
            // make finer changes if shift is being held
            var change = evt.shiftKey ? 1 : 5;
            // change tool size
            Tools.setSize(Tools.getSize() - deltaY / 100 * change);
        } else if (evt.shiftKey) {
            // scroll horizontally
            window.scrollTo(document.documentElement.scrollLeft + deltaY, document.documentElement.scrollTop + deltaX);
        } else {
            // regular scrolling
            window.scrollTo(document.documentElement.scrollLeft + deltaX, document.documentElement.scrollTop + deltaY);
        }
    }
    Tools.board.addEventListener("wheel", onwheel, { passive: false });

    Tools.board.addEventListener("touchmove", function ontouchmove(evt) {
        // 2-finger pan to zoom
        var touches = evt.touches;
        if (touches.length === 2) {
            var x0 = touches[0].clientX, x1 = touches[1].clientX,
                y0 = touches[0].clientY, y1 = touches[1].clientY,
                dx = x0 - x1,
                dy = y0 - y1;
            var x = (touches[0].pageX + touches[1].pageX) / 2 / Tools.getScale(),
                y = (touches[0].pageY + touches[1].pageY) / 2 / Tools.getScale();
            var distance = Math.sqrt(dx * dx + dy * dy);
            if (!pressed) {
                pressed = true;
                setOrigin(x, y, evt, true);
                origin.distance = distance;
            } else {
                var delta = distance - origin.distance;
                var scale = origin.scale * (1 + delta * ZOOM_FACTOR / 100);
                animate(scale);
            }
        }
    }, { passive: true });
    function touchend() {
        pressed = false;
    }
    Tools.board.addEventListener("touchend", touchend);
    Tools.board.addEventListener("touchcancel", touchend);

    function release(x, y, evt, isTouchEvent) {
        if (pressed && !moved) {
            var delta = (evt.shiftKey === true) ? -1 : 1;
            var scale = Tools.getScale() * (1 + delta * ZOOM_FACTOR);
            zoom(origin, scale);
        }
        pressed = false;
    }

    function key(down) {
        return function (evt) {
            if (evt.key === "Shift") {
                Tools.svg.style.cursor = "zoom-" + (down ? "out" : "in");
            }
        }
    }

    function getClientY(evt, isTouchEvent) {
        return isTouchEvent ? evt.changedTouches[0].clientY : evt.clientY;
    }

    var keydown = key(true);
    var keyup = key(false);

    function onstart() {
        window.addEventListener("keydown", keydown);
        window.addEventListener("keyup", keyup);
    }
    function onquit() {
        window.removeEventListener("keydown", keydown);
        window.removeEventListener("keyup", keyup);
    }

    function setIndex(newIndex) {
		index = +newIndex || 0;
	}

    var zoomTool = {
        "name": "Zoom",
        "shortcut": "z",
        "listeners": {
            "press": press,
            "move": move,
            "release": release,
        },
        "onstart": onstart,
        "onquit": onquit,
        "setIndex": setIndex,
        "mouseCursor": "zoom-in",
        "icon": "tools/zoom/icon.svg",
        "helpText": "click_to_zoom",
        "showMarker": true,
    };
    Tools.add(zoomTool);
})(); //End of code isolation
