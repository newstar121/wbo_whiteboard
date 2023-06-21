(function () {
	var board = Tools.board;
	const textEl = document.createElement("pre");
	// var svg = document.createElement("svg");
	// svg.id = "svg";
	// var input = document.createElement("div");
	// input.id = "textToolInput";
	// input.style.visibility = "hidden";
	// input.style.overflowWrap = "unset";
	// input.style.borderRadius = "15px";
	// input.style.padding = "7px 7px 7px 7px";
	
	// input.style.whiteSpace = "nowrap";
	// if (!input.parentNode) board.appendChild(input);

	// input.addEventListener("paste", function(e) {
	// 	// cancel paste
	// 	e.preventDefault();
	
	// 	// get text representation of clipboard
	// 	var text = (e.originalEvent || e).clipboardData.getData('text/plain');

	// 	// insert text manually
		
	// 	var list_array  = text.split("\n");
	// 	document.execCommand("insertText", false, list_array[0]);

	// 	for(var i = 1 ; i < list_array.length ; i ++) {
	// 		document.execCommand("insertLineBreak");
	// 		document.execCommand("insertText", false, list_array[i]);
	// 	}
	// });
	
	// input.addEventListener("paste", changeHandler);

	var curText = {
		"type": 'new',
		"x": 0,
		"y": 0,
		"color": '#000000',
		"fontName": '',
		"fontSize": 32,
		"text": '',
		"spellcheck": false,
		"id": null,
		
	};

	var active = false;
	var isEdit = false;

	const textSettingsPanel = document.getElementById('text-settings-panel');
	textSettingsPanel.classList.add('text-settings-panel-opened');
	textSettingsPanel.style.visibility = "hidden";
	
	function onQuit() {
		stopEdit();
	}

	function clickHandler(x, y, evt, isTouchEvent) {

		// if (evt.target === input) return;
		if (evt.target.tagName === "PRE") {
		    
			stopEdit();
			editOldText(evt.target);
			evt.preventDefault();
			isEdit = true;
		}
		else {
			stopEdit();
			isEdit = false;
			curText.x = x;
			curText.y = y;
			curText.id = Tools.generateUID();
			curText.color = Tools.getColor();
			Tools.setColor(curText.color);
			startEdit();
			evt.preventDefault();
		}
	}

	function editOldText(elem) {
		//elem.parentElement.style.visibility = "hidden";
		curText.id = elem.parentElement.id;
		var r = elem.getBoundingClientRect();
		var x = (r.left + document.documentElement.scrollLeft) / Tools.scale;
		var y = (r.top + document.documentElement.scrollTop) / Tools.scale;
		curText.x = x;
		curText.y = y;
		curText.text = elem.innerText;
		curText.fontSize = parseInt(elem.style['font-size']) * Tools.scale;
		curText.color = elem.style['color'];
	//currentColor.style.backgroundColor = curText.backgroundColor;
		const fontFamily = elem.style['font-family'].replace(/"/g, '');
		curText.fontName = fontFamily;
		Tools.setFontSize(curText.fontSize);
		//Tools.setbackgroundColor(curText.backgroundColor);
		const fontValueEl = document.getElementById('text-settings-value');
		fontValueEl.setAttribute('style', `font-family: ${fontFamily};`);
		fontValueEl.innerText = fontFamily;
		startEdit();

		// input.innerText = elem.textContent;


		// input.style.color = elem.style.color ? elem.style.color : "black";
		//input.style.backgroundColor = elem.style.backgroundColor ? elem.style.backgroundColor : "black";
		// placeCaretAtEnd(input);
	}

	function startEdit() {

		active = true;
		
		var x = (curText.x) * Tools.scale - Tools.board.scrollLeft - 5;
		textSettingsPanel.style.visibility = "visible";
		
		textEl.style.visibility = "visible";
		textEl.style.position = "absolute";
		textEl.style.left = x + 4 + 'px';

		textEl.style.top = (curText.y) * Tools.scale + 'px';
		
		if(textEl.parentElement) {
			textEl.style.left = (x + 4 - textEl.parentElement.x.baseVal.valueInSpecifiedUnits) + 'px';
			textEl.style.top = ((curText.y) * Tools.scale - textEl.parentElement.y.baseVal.valueInSpecifiedUnits) + 'px';
		}
		// textEl.style.fontSize = curText.fontSize * Tools.getScale() + 'px';
		textEl.style.fontFamily = curText.fontName;
		//input.style.backgroundColor = Tools.getbackgroundColor();
		textEl.style.border = "1px solid black";
		textEl.style.outline = "none";
	
		
		// textEl.style.minHeight = input.style.fontSize;
		textEl.style.minWidth = "10px";
		textEl.style.color = Tools.getColor();
		textEl.style.caretColor = curText.color;
		//input.style.padding = "0px 3px 0px 0px";
		textEl.style.transform = "scale(" + 1.0 + "," + 1.0 + ")";
		textEl.contentEditable = true;
		textEl.focus();

		textEl.addEventListener("keydown", changeHandler);
	}


	function changeHandler(evt) {
		// event.preventDefault()
		// event.stopPropagation()
		if (evt) {
			if (evt.key === 'Enter' && evt.shiftKey) {
			//input.style.top = (curText.y) * Tools.getScale() + 'px';    
            //stopEdit();
			//startEdit();
			} else if (evt.key === 'Enter') { // enter
				stopEdit();
				return;
			} else if (evt.which === 27) { // escape
				stopEdit();
				return;
			}
		}

		setTimeout(function () {
			const curTextEl = document.getElementById(curText.id);
			var parentHeight = 0;
			var parentWidth = 0;
			if (curTextEl) {
				parentHeight = curTextEl.childNodes[0].clientHeight;
				parentWidth = curTextEl.childNodes[0].clientWidth;
				curText.parentWidth = parentWidth;
				curText.parentHeight = parentHeight
			}
			// curText.parentWidth = parentWidth;
			// curText.parentHeight = parentHeight;
			curText.fontName = document.getElementById('text-settings-value').innerText;
			
			curText.fontSize = Tools.getFontSize();
			// curText.text = input.innerText;
			// curText.text = curText.text + evt.target.innerText;
			curText.text = evt?.target?.innerText || '';
			curText.type = isEdit ? 'update' : 'new';
			isEdit = true;

			Tools.drawAndSend(curText);
		}, 30);

	}

	function stopEdit() {
		active = false;
		const curTextEl = document.getElementById(curText.id);
		if(curTextEl) curTextEl.style.visibility = "visible";
		var text = curText.text;
		text = text.replace("\n", "");
		
		if(text.length === 0 && curTextEl) {
			var msg = {
				"type": "delete",
				"id": ""
			};
			msg.id = curTextEl.id;
			Tools.drawAndSend(msg, Tools.list.Eraser);
		}
		isEdit = false;
		curText.id = null;
		curText.text = "";
		textEl.textContent = ""
		// input.textContent = "";
		// input.style.visibility = "hidden";
		textSettingsPanel.style.visibility = "hidden";
		// input.removeEventListener("keydown", changeHandler);
	}

	function draw(data, isLocal) {
		Tools.drawingEvent = true;
        // input.style.color = 'red';
		textEl.style.fontSize = data.fontSize * Tools.getScale() + 'px';
		// textEl.style.minHeight = input.style.fontSize;
		textEl.style.fontFamily = data.fontName;
		
		switch (data.type) {
			case "new":
				createTextField(data);
				break;
			case "update":
				var curTextEl = document.getElementById(data.id);
				var textField = curTextEl.childNodes[0];
				if (textField === null) {
					console.error("Text: Hmmm... I received text that belongs to an unknown text field");
					return false;
				}
				updateText(textField, data.text, curTextEl);

				// Update Parent dimension after currText updated
				data.parentWidth = textField.clientWidth;
				data.parentHeight = textField.clientHeight;
				
				document.getElementById(data.id).setAttribute('height', data.parentHeight || 0);
				document.getElementById(data.id).setAttribute('width', data.parentWidth || 0);
				//textField.setAttribute("id", data.id);
				textField.setAttribute("style", `
				font-family: ${data.fontName}; 
				color: ${data.color}; 
			
				padding: 7px 7px 7px 7px;
				
				border-radius: 15px;
				font-size: ${data.fontSize}px;`);
			
				//input.style.width = data.parentWidth + 'px';
		        //input.style.height = data.parentHeight + 'px';
				
				
				break;
			case "delete":
				elem = document.getElementById(data.id);
				if (elem === null) console.error("Eraser: Tried to delete an element that does not exist.");
				else Tools.drawingArea.removeChild(elem);
				break;
			default:
				// console.error("Text: Draw instruction with unknown type. ", data);
				break;
		}
	}

	function updateText(textField, text) {
		textField.textContent = text;
	}

	function createTextField(fieldData) {
		var elem = Tools.createSVGElement("foreignObject");
        elem.setAttribute("class", "MathElement");
		elem.setAttribute("x", fieldData.x);
		elem.setAttribute("y", fieldData.y);
		elem.setAttribute("fill", fieldData.color);
		elem.setAttribute("stroke", fieldData.color);
		//elem.style.color = fieldData.color;
		
		elem.id = fieldData.id;
		textEl.setAttribute("style", `
		font-family: ${fieldData.fontName}; 
		color: ${fieldData.color}; 
		
		padding: 7px 7px 7px 7px;
	    
		border-radius: 15px;
		font-size: ${fieldData.fontSize}px;`);

		if (fieldData.text) updateText(textEl, fieldData.text, elem);
		elem.appendChild(textEl);
		elem.setAttribute('height', fieldData.parentHeight || 0);
		elem.setAttribute('width', fieldData.parentWidth || 0);
		
		Tools.drawingArea.appendChild(elem);

		return elem;
	}

	Tools.add({
		"name": "Text",
		"shortcut": "t",
		"listeners": {
			"press": clickHandler,
		},
		"changeHandler": changeHandler,
		"onquit": onQuit,
		"draw": draw,
		"mouseCursor": "text",
	});

	// function placeCaretAtEnd(element) {
	// 	if (element.getAttribute("contenteditable") === "true") {
	// 		window.getSelection().selectAllChildren(element)
	// 		window.getSelection().collapseToEnd()
	// 	}
	// }
})();