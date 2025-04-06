var React = require('react/addons');
var Tree = require('./lib/Tree');
var $ = require('jquery');
var Cursor = require('./lib/Cursor');
var _ = require('underscore');
var UndoRing = require('./lib/UndoRing');
var opml = require('opml-generator');

var ReactTree = {};
var globalTree;
var globalTreeBak;
var globalParseTree;
var globalUndoRing;
var globalDataSaved = true;
var globalSkipFocus = false; // TODO remove?
var globalCompletedHidden;
var globalDiffUncommitted = false;
var globalSkipNextUndo = false;
var globalInitialSelectionUuid = null; // Track the starting point of multi-selection

var DataSaved = React.createClass({
	render: function() {
		var text = globalDataSaved ? 'Saved' : 'Unsaved';
		return <span className="saved-text">{text}</span>;
	}
});

var TopLevelTree = React.createClass({
	render: function() {
		return <div>
			<div className="header">
				<span className="logo">Bearings</span>
				<SearchBox />
				<div className="header-buttons">
					<ResetButton />
					<a href="import.html">Import</a>
					<DataSaved />
					<CompleteHiddenButton />
				</div>{' '}
			</div>
			<div className="pad-wrapper">
				<div className="breadcrumbs-wrapper">
					<Breadcrumb node={this.props.tree} />
				</div>
				<ReactTree.TreeNode topBullet={true} node={this.props.tree.zoom} />
			</div>
		</div>;
	},

	componentDidUpdate: function() {
		if (globalSkipNextUndo) {
			globalSkipNextUndo = false;
		} else if (Object.keys(globalTree.diff).length > 0) {
			globalDiffUncommitted = true;
		}
		globalTree.diff = {};
	}
});

var Breadcrumb = React.createClass({
	render: function() {
		var text = this.breadcrumbToText(Tree.getBreadcrumb(this.props.node));
		if (text.length > 0) {
			return (
				<div>
					<span className="breadcrumb">
						{this.breadcrumbToText(Tree.getBreadcrumb(this.props.node))}
					</span>
					<hr />
				</div>
			);
		} else {
			return <div />;
		}
	},
	breadcrumbToText: function(titles) {
		if (titles.length > 0) {
			return titles.join(' > ') + ' >';
		}
		return '';
	}
});

var CompleteHiddenButton = React.createClass({
	render: function() {
		var text = globalCompletedHidden ? 'Show completed' : 'Hide completed';
		return (
			<a
				href="#"
				className="completed-hidden-button"
				onClick={this.handleClick}
			>
				{text}
			</a>
		);
	},
	handleClick: function(e) {
		globalCompletedHidden = !globalCompletedHidden;
		Tree.setCompletedHidden(globalTree, globalCompletedHidden);
		renderAll();
		e.preventDefault();
	}
});

var ResetButton = React.createClass({
	render: function() {
		return (
			<a href="#" onClick={this.handleClick}>
        Reset
			</a>
		);
	},
	handleClick: function(e) {
		console.log('reset');
		globalTree = Tree.makeDefaultTree();
		renderAll();
		e.preventDefault();
	}
});

var SearchBox = React.createClass({
	getInitialState: function() {
		return { value: '' };
	},
	handleChange: function(event) {
		this.setState({ value: event.target.value });
		console.log('cool', event.target.value);
		if (event.target.value.length === 0) {
			globalTree = globalTreeBak;
			globalTreeBak = null;
			renderAllNoUndo();
			return;
		}
		if (!globalTreeBak) {
			globalTreeBak = globalTree;
			globalTree = Tree.search(globalTree, event.target.value);
		} else {
			globalTree = Tree.search(globalTreeBak, event.target.value);
		}
		renderAllNoUndo();
	},
	handleFocus: function() {
		globalTree.selected = null;
	},
	render: function() {
		return (
			<input
				type="text"
				className="search"
				placeholder="Search"
				value={this.state.value}
				onChange={this.handleChange}
				onFocus={this.handleFocus}
			/>
		);
	}
});

ReactTree.TreeChildren = React.createClass({
	render: function() {
		var childNodes;
		if (this.props.childNodes != null) {
			childNodes = this.props.childNodes.map(function(node, index) {
				return (
					<li key={node.uuid}>
						<ReactTree.TreeNode node={node} />
					</li>
				);
			});
		}

		return <ul style={this.props.style}>{childNodes}</ul>;
	}
});
ReactTree.TreeNode = React.createClass({
	getInitialState: function() {
		return {
			mouseOver: false
		};
	},

	handleChange: function(event) {
		var html = this.refs.input.getDOMNode().textContent;
		if (html !== this.lastHtml) {
			globalDiffUncommitted = true;
			var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
			currentNode.title = event.target.textContent;
			globalTree.caretLoc = Cursor.getCaretCharacterOffsetWithin(
				this.refs.input.getDOMNode()
			);
			renderAll();
		} else {
			console.assert(
				false,
				'Why am I getting a change event if nothing changed?'
			);
		}
		this.lastHtml = html;
	},

	handleClick: function(event) {
		if (globalSkipFocus) {
			return;
		}
		var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
		
		// Clear multi-selection when clicking without shift key
		if (!event.shiftKey) {
			Tree.clearSelection(globalTree);
			globalInitialSelectionUuid = null;
		}
		
		globalTree.selected = currentNode.uuid;
		if (event.type === 'focus') {
			// clicking on the div, not the actual text. Also always fired when switching focus
			globalTree.caretLoc = currentNode.title.length;
		} else {
			// clicking on the text directly
			globalTree.caretLoc = Cursor.getCaretCharacterOffsetWithin(
				this.refs.input.getDOMNode()
			);
		}
		
		// If clicking with shift, add this node to the selection
		if (event.shiftKey) {
			Tree.addToSelection(globalTree, currentNode.uuid);
			renderAll();
		}
	},

	componentDidMount: function() {
		if (this.props.node.uuid === globalTree.selected) {
			var el = $(this.refs.input.getDOMNode());
			globalSkipFocus = true;
			el.focus();
			globalSkipFocus = false;
			Cursor.setCursorLoc(el[0], globalTree.caretLoc);
		}
	},

	handleKeyDown: function(e) {
		var KEYS = {
			LEFT: 37,
			UP: 38,
			RIGHT: 39,
			DOWN: 40,
			ENTER: 13,
			TAB: 9,
			BACKSPACE: 8,
			Z: 90,
			Y: 89,
			S: 83,
			C: 67,
			END: 35,
			HOME: 36,
			SPACE: 32,
		};
		if (e.keyCode === KEYS.LEFT) {
			if (e.ctrlKey) {
				Tree.zoomOutOne(globalTree);
				renderAll();
				e.preventDefault();
			} else {
				var newCaretLoc = Cursor.getCaretCharacterOffsetWithin(
					this.refs.input.getDOMNode()
				);
				if (newCaretLoc === 0) {
					Tree.selectPreviousNode(globalTree);
					var selected = Tree.findSelected(globalTree); // TODO could do this faster than two searches
					globalTree.caretLoc = selected.title.length;
					renderAll();
					e.preventDefault();
				} else {
					globalTree.caretLoc = newCaretLoc - 1;
				}
			}
		} else if (e.keyCode === KEYS.END && e.ctrlKey) {
			Tree.selectLastNode(globalTree);
			renderAll();
			e.preventDefault();
		} else if (e.keyCode === KEYS.HOME && e.ctrlKey) {
			Tree.selectFirstNode(globalTree);
			renderAll();
			e.preventDefault();
		} else if (e.keyCode === KEYS.UP) {
			if (e.shiftKey && e.ctrlKey) {
				Tree.shiftUp(globalTree);
				renderAll();
				e.preventDefault();
			} else if (e.shiftKey) {
				// Handle multi-select with shift+up
				var selected = Tree.findSelected(globalTree);
				var previous = Tree.findPreviousNode(selected);
				
				if (previous) {
					// If this is the first shift selection, store the initial point
					if (globalTree.selectedNodes.length === 0) {
						globalInitialSelectionUuid = selected.uuid;
						Tree.addToSelection(globalTree, selected.uuid);
					}
					
					// Get the initial selection node (if it exists)
					var initialNode = globalInitialSelectionUuid ? 
						Tree.findFromUUID(globalTree, globalInitialSelectionUuid) : selected;
					
					// If we're moving away from initial selection point or at the initial point
					if (!initialNode || Tree.isNodeBefore(previous, initialNode) || selected.uuid === initialNode.uuid) {
						// Add the previous node to selection
						Tree.addToSelection(globalTree, previous.uuid);
					} else {
						// We're moving toward initial selection - remove current node from selection
						Tree.removeFromSelection(globalTree, selected.uuid);
					}
					
					// Update the primary selection
					globalTree.selected = previous.uuid;
					
					globalTree.caretLoc = 0;
					renderAll();
				}
				e.preventDefault();
			} else {
				// Clear multi-selection when navigating without shift
				Tree.clearSelection(globalTree);
				globalInitialSelectionUuid = null;
				Tree.selectPreviousNode(globalTree);
				globalTree.caretLoc = 0;
				renderAll();
			}
			e.preventDefault();
		} else if (e.keyCode === KEYS.RIGHT) {
			if (e.ctrlKey) {
				var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
				Tree.zoom(currentNode);
				renderAll();
				e.preventDefault();
			} else {
				let newCaretLoc = Cursor.getCaretCharacterOffsetWithin(
					this.refs.input.getDOMNode()
				);
				if (newCaretLoc === this.refs.input.getDOMNode().textContent.length) {
					// Clear multi-selection when navigating without shift
					Tree.clearSelection(globalTree);
					Tree.selectNextNode(globalTree);
					globalTree.caretLoc = 0;
					renderAll();
					e.preventDefault();
				} else {
					globalTree.caretLoc = newCaretLoc + 1;
				}
			}
		} else if (e.keyCode === KEYS.DOWN) {
			if (e.shiftKey && e.ctrlKey) {
				Tree.shiftDown(globalTree);
				renderAll();
				e.preventDefault();
			} else if (e.shiftKey) {
				// Handle multi-select with shift+down
				var selected = Tree.findSelected(globalTree);
				var next = Tree.findNextNode(selected);
				
				if (next) {
					// If this is the first shift selection, store the initial point
					if (globalTree.selectedNodes.length === 0) {
						globalInitialSelectionUuid = selected.uuid;
						Tree.addToSelection(globalTree, selected.uuid);
					}
					
					// Get the initial selection node (if it exists)
					var initialNode = globalInitialSelectionUuid ? 
						Tree.findFromUUID(globalTree, globalInitialSelectionUuid) : selected;
					
					// If we're moving away from initial selection point or at the initial point
					if (!initialNode || Tree.isNodeBefore(initialNode, next) || selected.uuid === initialNode.uuid) {
						// Add the next node to selection
						Tree.addToSelection(globalTree, next.uuid);
					} else {
						// We're moving toward initial selection - remove current node from selection
						Tree.removeFromSelection(globalTree, selected.uuid);
					}
					
					// Update the primary selection
					globalTree.selected = next.uuid;
					
					globalTree.caretLoc = 0;
					renderAll();
				}
				e.preventDefault();
			} else {
				// Clear multi-selection when navigating without shift
				Tree.clearSelection(globalTree);
				globalInitialSelectionUuid = null;
				console.log('down');
				Tree.selectNextNode(globalTree);
				globalTree.caretLoc = 0;
				renderAll();
			}
			e.preventDefault();
		} else if (e.keyCode === KEYS.ENTER && e.ctrlKey) {
			console.log('complete current');
			Tree.completeCurrent(globalTree);
			renderAll();
			e.preventDefault();
		} else if (e.keyCode === KEYS.ENTER) {
			var caretLoc = Cursor.getCaretCharacterOffsetWithin(
				this.refs.input.getDOMNode()
			);
			globalTree.caretLoc = caretLoc;
			console.log('loc', caretLoc);
			Tree.newLineAtCursor(globalTree);
			renderAll();
			e.preventDefault();
		} else if (e.keyCode === KEYS.BACKSPACE) {
			if (e.ctrlKey && e.shiftKey) {
				// Delete selected nodes - either multi-selection or current node
				Tree.deleteSelected(globalTree);
				renderAll();
				e.preventDefault();
			} else if (globalTree.selectedNodes && globalTree.selectedNodes.length > 0) {
				// If there are multiple selected nodes and regular backspace is pressed
				if (confirm("Delete all selected items?")) {
					Tree.deleteSelected(globalTree);
					renderAll();
				}
				e.preventDefault();
			} else {
				globalTree.caretLoc = Cursor.getCaretCharacterOffsetWithin(
					this.refs.input.getDOMNode()
				);
				if (globalTree.caretLoc === 0) {
					Tree.backspaceAtBeginning(globalTree);
					renderAll();
					e.preventDefault();
				}
			}
		} else if (e.keyCode === KEYS.TAB) {
			if (e.shiftKey) {
				Tree.unindent(globalTree);
			} else {
				Tree.indent(globalTree);
			}
			globalDiffUncommitted = true;
			renderAll();
			e.preventDefault();
		} else if (e.keyCode === KEYS.SPACE && e.ctrlKey) {
			Tree.collapseCurrent(globalTree);
			globalDiffUncommitted = true;
			renderAll();
			e.preventDefault();
		} else if (e.keyCode === KEYS.Z && (e.ctrlKey || e.metaKey)) {
			globalTree = Tree.clone(globalUndoRing.undo());
			renderAllNoUndo();
			e.preventDefault();
		} else if (e.keyCode === KEYS.Y && (e.ctrlKey || e.metaKey)) {
			globalTree = Tree.clone(globalUndoRing.redo());
			renderAllNoUndo();
			e.preventDefault();
		} else if (e.keyCode === KEYS.S && e.ctrlKey) {
			console.log('ctrl s');
			console.log(JSON.stringify(Tree.cloneNoParentClean(globalTree), null, 4));
			window.prompt(
				'Copy to clipboard: Ctrl+C, Enter',
				JSON.stringify(Tree.cloneNoParentClean(globalTree), null, 4)
			);
			e.preventDefault();
		} else if (e.keyCode === KEYS.C && e.ctrlKey) {
			let currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
			var outlines = Tree.toOutline(currentNode);
			console.log(opml({}, [outlines]));
			e.preventDefault();
		} else {
			// console.log(e.keyCode);
		}
	},

	componentDidUpdate: function() {
		console.log('updated', this.props.node.title);
		if (this.props.node.uuid === globalTree.selected) {
			var el = $(this.refs.input.getDOMNode());
			globalSkipFocus = true;
			//console.log('focus on', this.props.node.title);
			el.focus();
			globalSkipFocus = false;
			Cursor.setCursorLoc(el[0], globalTree.caretLoc);
		}
		if (
			this.refs.input &&
      this.props.node.title !== this.refs.input.getDOMNode().textContent
		) {
			// Need this because of: http://stackoverflow.com/questions/22677931/react-js-onchange-event-for-contenteditable/27255103#27255103
			// An example he was mentioning is that the virtual dom thinks that the div is empty, but if
			// you type something and then press "clear", or specifically set the text, the VDOM will
			// think the two are the same.
			// This is necessary when doing undo/redo. Then we'll be explicitly setting the text of the DOM
			this.refs.input.getDOMNode().textContent = this.props.node.title;
		}
	},

	shouldComponentUpdate: function(nextProps, nextState) {
		if (!_.isEqual(this.state, nextState)) {
			return true;
		}
		if ('run_full_diff' in globalTree.diff) {
			return true;
		}
		return this.props.node.uuid in globalTree.diff;
	},
	// TODO something about cursor jumps need this?
	// See: http://stackoverflow.com/questions/22677931/react-js-onchange-event-for-contenteditable/27255103#27255103
	// I think what "cursor jump" means is that if we set the textContent for some reason, but we are
	// actually just setting it to be the exact same html, then the cursor will jump to the front/end.
	//shouldComponentUpdate: function(nextProps){
	//return nextProps.html !== this.getDOMNode().textContent;
	//},

	render: function() {
		var className = 'dot';


		if (this.props.node.childNodes != null) {
			className = 'dot togglable';
			if (this.props.node.collapsed) {
				className += ' dot-collapsed';
			}
		}

		var contentClassName = 'editable';
		if (this.props.topBullet) {
			contentClassName = 'editable topBullet';
		}
		if (this.props.node.title == 'special_root_title') {
			contentClassName += ' display-none';
		}

		if (this.props.node.completed) {
			contentClassName += ' completed';
		}
		
		// Add highlighting for multi-selected nodes
		var root = Tree.getRoot(globalTree);
		if (root.selectedNodes && root.selectedNodes.includes(this.props.node.uuid)) {
			contentClassName += ' multi-selected';
		}

		var plus;
		if (this.state.mouseOver) {
			if (this.props.node.childNodes != null && this.props.node.collapsed) {
				plus = (
					<div onClick={this.toggle} className="collapseButton">
            +
					</div>
				);
			} else {
				plus = (
					<div onClick={this.toggle} className="collapseButton">
            -
					</div>
				);
			}
		}
		var bulletPoint = '';
		if (!this.props.topBullet) {
			bulletPoint = (
				<span
					onClick={this.zoom}
					onMouseOver={this.mouseOver}
					className={className}
				>
					{String.fromCharCode(8226)}
				</span>
			);
		}

		var children = '';
		if (this.props.topBullet || !this.props.node.collapsed) {
			children = (
				<ReactTree.TreeChildren childNodes={this.props.node.childNodes} />
			);
		}

		if (
			this.props.node.completed &&
      globalCompletedHidden &&
      !this.props.topBullet
		) {
			return false;
		}

		var textBox = (
			<div
				className={contentClassName}
				contentEditable
				ref="input"
				onKeyDown={this.handleKeyDown}
				onInput={this.handleChange}
				onFocus={this.handleClick}
				onClick={this.handleClick}
				dangerouslySetInnerHTML={{ __html: _.escape(this.props.node.title) }}
			/>
		);
		if (globalTreeBak) {
			textBox = (
				<div
					className={contentClassName}
					ref="input"
					onKeyDown={this.handleKeyDown}
					onInput={this.handleChange}
					onFocus={this.handleClick}
					onClick={this.handleClick}
					dangerouslySetInnerHTML={{ __html: _.escape(this.props.node.title) }}
				/>
			);
		}
		return (
			<div className="node-wrapper" onMouseLeave={this.mouseOut}>
				<div className="node-direct-wrapper">
					{bulletPoint}
					<div className="plus-wrapper">{plus}</div>
					{textBox}
				</div>
				{children}
			</div>
		);
	},

	toggle: function() {
		var currentNode = Tree.findFromUUID(globalTree, this.props.node.uuid);
		globalTree.selected = currentNode.uuid;
		Tree.collapseCurrent(globalTree);
		renderAll();
	},
	mouseOver: function() {
		this.setState({ mouseOver: true });
	},
	mouseOut: function() {
		this.setState({ mouseOver: false });
	},
	zoom: function() {
		var node = Tree.findFromUUID(globalTree, this.props.node.uuid);
		Tree.zoom(node);
		globalTree.selected = node.uuid;
		renderAll();
	}
});

ReactTree.startRender = function(parseTree) {
	globalTree = Tree.fromString(parseTree.get('tree'));
	console.log(globalTree);
	console.log('hidden is', Tree.isCompletedHidden(globalTree));
	globalCompletedHidden = Tree.isCompletedHidden(globalTree);
	globalParseTree = parseTree;
	var newTree = Tree.clone(globalTree);
	globalUndoRing = new UndoRing(newTree, 50); // TODO un hardcode
	renderAll();

	setInterval(function() {
		// if (!globalDataSaved) {
		// 	globalParseTree.set('tree', Tree.toString(globalTree));
		// 	globalParseTree.save();
		// 	globalDataSaved = true;
		// 	renderAllNoUndo();
		// }
		if (globalDiffUncommitted) {
			globalDiffUncommitted = false;
			var newTree = Tree.clone(globalTree);
			globalUndoRing.addPending(newTree);
			globalUndoRing.commit();
		}
		
		// Auto-save to localStorage
		if (!globalDataSaved) {
			console.log('Saving to localStorage');
			localStorage.setItem('bearings_tree', Tree.toString(globalTree));
			globalDataSaved = true;
			renderAllNoUndo();
		}
	}, 2000);
};

function renderAll() {
	if (globalDiffUncommitted) {
		// TODO this needs to get set to false when running undo...
		globalDataSaved = false;
	}
	doRender(globalTree);
}

function renderAllNoUndo() {
	globalTree.diff['run_full_diff'] = true;
	globalSkipNextUndo = true;
	doRender(globalTree);
}

ReactTree.to_react_element = function(tree) {
	return (
		<TopLevelTree tree={tree} />
	);
};

function doRender(tree) {
	//console.log('rendering with', Tree.toString(tree));

	// TODO should always have a zoom?
	//<ReactTree.TreeChildren childNodes={tree.zoom.childNodes} />
	if (tree.zoom !== undefined) {
		React.render(
			ReactTree.to_react_element(tree),
			document.getElementById('tree')
		);
	} else {
		// TODO remove
		console.assert(false, 'I didn\'t think this would happen');
		//console.log('no zoom');
		//React.render(
		//<div>
		//<ResetButton/> | <a href="import.html">Import</a> | <DataSaved />
		//<div><Breadcrumb node={tree} /></div>
		//<ReactTree.TreeNode node={tree}/>
		//</div>,
		//document.getElementById("tree")
		//);
	}
}

module.exports = ReactTree;
