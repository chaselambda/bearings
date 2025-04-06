var Tree = {};
module.exports = exports = Tree;

Tree.generateUUID = function() {
	var d = new Date().getTime();
	var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(
		c
	) {
		var r = ((d + Math.random() * 16) % 16) | 0;
		d = Math.floor(d / 16);
		return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
	});
	return uuid;
};

// Tree.getAllChildren = function(tree) {
// 	var ret = [];
// 	console.log('get all children of', tree.title);
// 	var toProcess = tree.childNodes.map(function (x) {return x;});
// 	while (toProcess.length > 0) {
// 		console.log('popping of', toProcess);
// 		var node = toProcess.pop();
// 		console.log('pushing', node.title);
// 		ret.push(node);
// 		toProcess = toProcess.concat(node.childNodes.map(function (x) {return x;}));
// 	}
// 	console.log('all children is', ret.map(function (n) { return n.title; }));
// 	return ret;
// }

Tree.addDiff = function(node) {
	// TODO, speed this up too...
	var chain = Tree.getParentChain(node);
	var root = Tree.getRoot(node);
	chain.forEach(function (n) {
		root.diff[n.uuid] = true;
	});
};

Tree.addAllDiff = function(node) {
	var root = Tree.getRoot(node);
	root.diff['run_full_diff'] = true;
};

Tree.getParentChain = function(node) {
	var ret = [];
	while (node.title !== 'special_root_title') {
		ret.push(node);
		node = node.parent;
	}
	ret.push(node);
	return ret;
};

Tree.selectNextNode = function(tree) {
	var selected = Tree.findSelected(tree);
	var root = Tree.getRoot(tree);
	var next = Tree.findNextNode(selected);
	if (next) {
		root.selected = next.uuid;
		Tree.addDiff(next);
	}
};

Tree.selectPreviousNode = function(tree) {
	var selected = Tree.findSelected(tree);
	var root = Tree.getRoot(tree);
	var previous = Tree.findPreviousNode(selected);
	if (previous) {
		root.selected = previous.uuid;
		Tree.addDiff(previous);
	}
};

// TODO shouldn't this be the last node of the current zoom?
Tree.selectLastNode = function(tree) {
	var root = Tree.getRoot(tree);
	var last = Tree.findDeepest(
		root.zoom.childNodes[root.zoom.childNodes.length - 1]
	);
	root.selected = last.uuid;
	root.caretLoc = last.title.length;
};

Tree.selectFirstNode = function(tree) {
	var root = Tree.getRoot(tree);
	root.selected = root.zoom.uuid;
	root.caretLoc = 0;
};

Tree.appendSibling = function(tree, title) {
	var i;
	for (i = 0; i < tree.parent.childNodes.length; i++) {
		if (tree.parent.childNodes[i] == tree) {
			break;
		}
	}
	var ret = Tree.makeNode({ title: title, parent: tree.parent });
	Tree.addUUIDPointer(ret);
	tree.parent.childNodes.splice(i + 1, 0, ret);
	Tree.addDiff(tree.parent);
	return ret;
};

Tree.newChildAtCursor = function(selected) {
	var ret = Tree.makeNode({ title: '', parent: selected });
	Tree.addDiff(selected.parent);
	Tree.addDiff(selected);
	Tree.addDiff(ret);
	var root = Tree.getRoot(selected);
	Tree.addUUIDPointer(ret);
	if (selected.childNodes) {
		selected.childNodes.unshift(ret);
	} else {
		selected.childNodes = [ret];
	}
	root.selected = ret.uuid;
	root.caretLoc = 0;
};

Tree.newLineAtCursor = function(tree) {
	var selected = Tree.findSelected(tree);
	var root = Tree.getRoot(tree);
	var textStart = selected.title.substr(0, root.caretLoc);
	var textRest = selected.title.substr(root.caretLoc);
	if (
		selected === root.zoom ||
    (textRest.length === 0 &&
      selected.childNodes.length > 0 &&
      !selected.collapsed)
	) {
		Tree.newChildAtCursor(selected, root);
	} else {
		selected.title = textStart;
		var nextNode = Tree.appendSibling(selected, textRest);
		Tree.addDiff(nextNode);
		Tree.addDiff(selected);
		if (textRest.length > 0) {
			Tree.setChildNodes(nextNode, selected.childNodes);
			Tree.setChildNodes(selected, []);
			if (selected.collapsed) {
				nextNode.collapsed = true;
				delete selected.collapsed;
			}
		}
		if (
			textStart.length > 0 ||
      (textStart.length === 0 && textRest.length === 0)
		) {
			root.selected = nextNode.uuid;
		}
		root.caretLoc = 0;
	}
};

Tree.addUUIDPointer = function(tree) {
	var root = Tree.getRoot(tree);
	root.uuidMap[tree.uuid] = tree;
};

Tree.addUUIDPointers = function(tree) {
	Tree.addUUIDPointer(tree);
	tree.childNodes.map(function(child) {
		Tree.addUUIDPointers(child);
	});
};

Tree.findFromUUID = function(tree, uuid) {
	var root = Tree.getRoot(tree);
	return root.uuidMap[uuid];
};

Tree.setIfReal = function(toObj, fromObj, property, defaultVal) {
	if (fromObj[property] === undefined) {
		if (defaultVal !== undefined) {
			toObj[property] = defaultVal;
		}
		return;
	}
	toObj[property] = fromObj[property];
};

Tree.makeNode = function(args) {
	var ret = {};
	Tree.setIfReal(ret, args, 'title');
	Tree.setIfReal(ret, args, 'childNodes', []);
	Tree.setIfReal(ret, args, 'parent');
	Tree.setIfReal(ret, args, 'selected');
	Tree.setIfReal(ret, args, 'collapsed');
	Tree.setIfReal(ret, args, 'completed');
	Tree.setIfReal(ret, args, 'completedHidden');
	Tree.setIfReal(ret, args, 'caretLoc');
	Tree.setIfReal(ret, args, 'uuid', Tree.generateUUID());
	Tree.setIfReal(ret, args, 'uuidMap');
	Tree.setIfReal(ret, args, 'zoom');
	Tree.setIfReal(ret, args, 'diff');
	Tree.setIfReal(ret, args, 'selectedNodes', []);
	return ret;
};

Tree.clone = function(tree) {
	// TODO this only really makes sense to use this clone for root stuff (see addUUIDPointers).. let's call it something else?
	var ret = Tree.cloneGeneral(tree, null, { noparent: false, nomouse: false });
	Tree.addUUIDPointers(ret);
	if (tree.zoom) {
		// TODO should be an invariant
		var root = Tree.getRoot(ret);
		ret.zoom = root.uuidMap[tree.zoomUUID];
	}
	return ret;
};

Tree.cloneNoParent = function(tree) {
	return Tree.cloneGeneral(tree, null, { noparent: true, nomouse: false });
};

Tree.cloneNoParentNoCursor = function(tree) {
	return Tree.cloneGeneral(tree, null, { noparent: true, nomouse: true });
};

Tree.cloneNoParentClean = function(tree) {
	return Tree.cloneGeneral(tree, null, {
		noparent: true,
		nomouse: false,
		clean: true
	});
};

Tree.cloneGeneral = function(tree, parent, options) {
	var me = Tree.makeNode(
		{
			title: tree.title,
			parent: options.noparent ? undefined : parent,
			selected: options.nomouse ? undefined : tree.selected,
			collapsed: tree.collapsed,
			completed: tree.completed,
			caretLoc: options.nomouse ? undefined : tree.caretLoc,
			uuid: tree.uuid,
			uuidMap: options.noparent ? undefined : {},
			completedHidden: tree.completedHidden,
			diff: options.noparent ? undefined : {},
			selectedNodes: options.nomouse ? undefined : (tree.selectedNodes || []),
		},
		{ clean: options.clean }
	);
	if (tree.childNodes && tree.childNodes.length > 0) {
		me.childNodes = tree.childNodes.map(function(node) {
			return Tree.cloneGeneral(node, me, options);
		});
	} else if (options.clean) {
		me.childNodes = undefined;
	}
	me.zoomUUID = tree.zoomUUID;
	return me;
};

Tree.indent = function(tree) {
	var root = Tree.getRoot(tree);
	var selected = Tree.findSelected(tree);
	
	// Check if we have multiple selected nodes
	if (root.selectedNodes && root.selectedNodes.length > 0) {
		// Group the selected nodes by parent
		var nodesByParent = {};
		for (var i = 0; i < root.selectedNodes.length; i++) {
			var nodeUuid = root.selectedNodes[i];
			var node = Tree.findFromUUID(tree, nodeUuid);
			var parentUuid = node.parent.uuid;
			
			if (!nodesByParent[parentUuid]) {
				nodesByParent[parentUuid] = [];
			}
			nodesByParent[parentUuid].push(node);
		}
		
		// Process each parent's group of selected nodes
		for (var parentUuid in nodesByParent) {
			var nodesInParent = nodesByParent[parentUuid];
			if (nodesInParent.length === 0) continue;
			
			// Sort nodes by index, lowest first
			nodesInParent.sort(function(a, b) {
				return Tree.findChildNum(a) - Tree.findChildNum(b);
			});
			
			// Find the first selected node in this parent
			var firstSelectedNode = nodesInParent[0];
			var firstSelectedIndex = Tree.findChildNum(firstSelectedNode);
			
			// Skip if it's the first child (can't indent)
			if (firstSelectedIndex === 0) {
				continue;
			}
			
			// Use the node right before the first selected node as the new parent for all selected nodes
			var newParent = firstSelectedNode.parent.childNodes[firstSelectedIndex - 1];
			delete newParent.collapsed; // Expand the parent to show the indented nodes
			
			// Process nodes in reverse order to avoid index shifting issues
			nodesInParent.sort(function(a, b) {
				return Tree.findChildNum(b) - Tree.findChildNum(a);
			});
			
			for (var i = 0; i < nodesInParent.length; i++) {
				var node = nodesInParent[i];
				var childNum = Tree.findChildNum(node);
				
				// Remove from the original parent
				node.parent.childNodes.splice(childNum, 1);
				
				// Add to the new parent's children
				newParent.childNodes.push(node);
				
				// Update parent reference
				node.parent = newParent;
				
				// Mark for rendering
				Tree.addDiff(node);
			}
			
			// Mark the new parent for rendering
			Tree.addDiff(newParent);
		}
		
		// Mark everything for rendering to be safe
		Tree.addAllDiff(root);
		return;
	}
	
	// Original single-node indent behavior
	var childNum = Tree.findChildNum(selected);
	if (childNum == 0) {
		return;
	}
	var newParent = selected.parent.childNodes[childNum - 1];
	delete newParent.collapsed;
	newParent.childNodes.push(selected);
	selected.parent.childNodes.splice(childNum, 1);
	selected.parent = newParent;
	// TODO diff is oldParent + newParent + selected + children of selected
	Tree.addAllDiff(selected);
};

Tree.unindent = function(tree) {
	var root = Tree.getRoot(tree);
	var selected = Tree.findSelected(tree);
	
	// Check if we have multiple selected nodes
	if (root.selectedNodes && root.selectedNodes.length > 0) {
		// Step 1: Build a node hierarchy map to track parent-child relationships
		var nodeMap = {};
		var topLevelSelectedNodes = [];
		var selectedNodes = [];
		
		// First pass: build the mapping of nodes and identify which nodes are in the selection
		for (var i = 0; i < root.selectedNodes.length; i++) {
			var node = Tree.findFromUUID(tree, root.selectedNodes[i]);
			selectedNodes.push(node);
			nodeMap[node.uuid] = { 
				node: node, 
				isTopLevel: true, // Assume top level until we find it's a child of another selected node
				children: []
			};
		}
		
		// Second pass: establish parent-child relationships within selected nodes
		for (var i = 0; i < selectedNodes.length; i++) {
			var node = selectedNodes[i];
			// Check if this node's parent is also selected
			var parentInSelection = false;
			
			for (var j = 0; j < selectedNodes.length; j++) {
				var potentialParent = selectedNodes[j];
				if (potentialParent !== node && node.parent === potentialParent) {
					// This node has a parent in the selection
					nodeMap[node.uuid].isTopLevel = false;
					nodeMap[potentialParent.uuid].children.push(node);
					parentInSelection = true;
					break;
				}
			}
			
			if (!parentInSelection && nodeMap[node.uuid].isTopLevel) {
				topLevelSelectedNodes.push(node);
			}
		}
		
		// Step 2: Process only the top-level selected nodes
		// Sort by parent/position to maintain order
		topLevelSelectedNodes.sort(function(a, b) {
			if (a.parent !== b.parent) {
				return 0; // Different parents, keep original order
			}
			return Tree.findChildNum(a) - Tree.findChildNum(b);
		});
		
		// Process each top-level selected node
		for (var i = 0; i < topLevelSelectedNodes.length; i++) {
			var topNode = topLevelSelectedNodes[i];
			
			// Skip if it's a root-level node or the parent is the zoom point
			if (!topNode.parent.parent || topNode === root.zoom || topNode.parent === root.zoom) {
				continue;
			}
			
			var childNum = Tree.findChildNum(topNode);
			var parentChildNum = Tree.findChildNum(topNode.parent);
			var newParent = topNode.parent.parent;
			
			// Move the node to the appropriate position under the grandparent (with all its children)
			newParent.childNodes.splice(parentChildNum + 1, 0, topNode);
			
			// Remove from the original parent
			topNode.parent.childNodes.splice(childNum, 1);
			
			// Update parent reference
			topNode.parent = newParent;
			
			// Mark for rendering
			Tree.addDiff(topNode);
			Tree.addDiff(newParent);
		}
		
		// Mark everything for rendering to be safe
		Tree.addAllDiff(root);
		return;
	}
	
	// Original single-node unindent behavior
	if (!selected.parent.parent) {
		return;
	}
	if (selected === root.zoom || selected.parent === root.zoom) {
		return;
	}
	var childNum = Tree.findChildNum(selected);
	var parentChildNum = Tree.findChildNum(selected.parent);
	var newParent = selected.parent.parent;
	newParent.childNodes.splice(parentChildNum + 1, 0, selected);
	selected.parent.childNodes.splice(childNum, 1);
	selected.parent = newParent;
	// TODO diff is oldParent + newParent + selected + children of selected
	Tree.addAllDiff(selected);
};

Tree.shiftUp = function(tree) {
	var selected = Tree.findSelected(tree);
	var childNum = Tree.findChildNum(selected);
	var parent = selected.parent;
	if (childNum == 0) {
		return;
	}
	if (parent.childNodes.length <= 1) {
		return;
	}
	var tmp = parent.childNodes[childNum];
	parent.childNodes[childNum] = parent.childNodes[childNum - 1];
	parent.childNodes[childNum - 1] = tmp;
	Tree.addDiff(parent);
};

Tree.shiftDown = function(tree) {
	var selected = Tree.findSelected(tree);
	var childNum = Tree.findChildNum(selected);
	var parent = selected.parent;
	if (childNum == parent.childNodes.length - 1) {
		return;
	}
	if (parent.childNodes.length <= 1) {
		return;
	}
	var tmp = parent.childNodes[childNum];
	parent.childNodes[childNum] = parent.childNodes[childNum + 1];
	parent.childNodes[childNum + 1] = tmp;
	Tree.addDiff(parent);
};

Tree.findChildNum = function(tree) {
	var i;
	for (i = 0; i < tree.parent.childNodes.length; i++) {
		if (tree.parent.childNodes[i] == tree) {
			return i;
		}
	}
	console.assert(false);
};

Tree.getRoot = function(tree) {
	if (tree.title === 'special_root_title') {
		return tree;
	}
	return Tree.getRoot(tree.parent);
};

Tree.getBreadcrumb = function(root) {
	if (root.zoom.title === 'special_root_title') {
		return [];
	}
	var ret = Tree.getBreadcrumbInner(root.zoom.parent);
	ret.unshift('Home');
	return ret;
};

Tree.getBreadcrumbInner = function(tree) {
	if (tree.title === 'special_root_title') {
		return [];
	}
	var ret = Tree.getBreadcrumbInner(tree.parent);
	ret.push(tree.title);
	return ret;
};

Tree.zoom = function(tree) {
	if (!tree) {
		console.log('cannot zoom that high!');
		return;
	}
	var root = Tree.getRoot(tree);
	root.zoom = tree;
	root.zoomUUID = tree.uuid;
	Tree.addAllDiff(root);
};

Tree.zoomOutOne = function(tree) {
	var root = Tree.getRoot(tree);
	if (root.zoom) {
		if (root.zoom.parent) {
			root.selected = root.zoom.uuid;
			root.caretLoc = 0;
			Tree.zoom(root.zoom.parent);
		}
	} else {
		// TODO ever get hit?
		console.assert(false, 'something wrong');
	}
	Tree.addAllDiff(root);
};

Tree.deleteSelected = function(tree) {
	var root = Tree.getRoot(tree);
	
	// Handle multiple selected nodes
	if (root.selectedNodes && root.selectedNodes.length > 0) {
		// Convert UUIDs to node references
		var selectedNodes = [];
		for (var i = 0; i < root.selectedNodes.length; i++) {
			selectedNodes.push(Tree.findFromUUID(tree, root.selectedNodes[i]));
		}
		
		// Sort the selected nodes in reverse order by their position
		// to avoid index shifting problems when removing nodes
		selectedNodes.sort(function(a, b) {
			var aParent = a.parent;
			var bParent = b.parent;
			
			// If they have the same parent, sort by child index
			if (aParent === bParent) {
				return Tree.findChildNum(b) - Tree.findChildNum(a);
			}
			
			// Otherwise, they can't be sorted reliably, so maintain original order
			return 0;
		});
		
		// Get a viable next selection node (the node before the first selected node)
		var nextSelection = Tree.findPreviousNode(selectedNodes[selectedNodes.length - 1]);
		
		if (!nextSelection) {
			// If no previous node, try to find a node after the last selected node
			var lastNode = selectedNodes[0];
			nextSelection = Tree.findNextNodeRec(lastNode, root.zoom);
			
			// If still no selection, use first node of root
			if (!nextSelection && root.childNodes.length > 0) {
				for (var i = 0; i < root.childNodes.length; i++) {
					if (!selectedNodes.includes(root.childNodes[i])) {
						nextSelection = root.childNodes[i];
						break;
					}
				}
			}
		}
		
		// Delete each selected node
		for (var i = 0; i < selectedNodes.length; i++) {
			var node = selectedNodes[i];
			
			// Skip the root node or last remaining node
			if (node === root.zoom || (node.parent.title === 'special_root_title' && node.parent.childNodes.length <= 1)) {
				continue;
			}
			
			var childNum = Tree.findChildNum(node);
			node.parent.childNodes.splice(childNum, 1);
			Tree.addDiff(node.parent);
		}
		
		// Update selection to the next node
		if (nextSelection) {
			root.selected = nextSelection.uuid;
			root.caretLoc = nextSelection.title.length;
			Tree.addDiff(nextSelection);
		} else {
			// If no suitable next selection was found, clear selection
			root.selected = null;
		}
		
		// Clear the multi-selection
		root.selectedNodes = [];
		Tree.addAllDiff(root);
		return;
	}
	
	// Original single-node deletion behavior
	var selected = Tree.findSelected(tree);
	var nextSelection = Tree.findPreviousNode(selected);
	
	if (!nextSelection) {
		console.assert(selected.parent.title === 'special_root_title');
		if (selected.parent.childNodes.length > 1) {
			nextSelection = selected.parent.childNodes[1];
		} else {
			selected.title = '';
			selected.childNodes = [];
			root.caretLoc = 0;
			delete selected.collapsed;
			delete selected.completed; // TODO do I want this?
			// No speed concern here, because this happens when the workflowy document is fully empty
			Tree.addAllDiff(root);
			return;
		}
	}
	var childNum = Tree.findChildNum(selected);
	selected.parent.childNodes.splice(childNum, 1);
	root.selected = nextSelection.uuid;
	root.caretLoc = nextSelection.title.length;
	Tree.addDiff(selected.parent);
	Tree.addDiff(nextSelection);
};

Tree.backspaceAtBeginning = function(tree) {
	// TODO think if this is the root
	var selected = Tree.findSelected(tree);
	var root = Tree.getRoot(tree);
	if (root.caretLoc !== 0) {
		console.log(
			'TODO: home/end keys do not update caretLoc, and so this invariant fails'
		);
	}
	var previous = Tree.findPreviousNode(selected);
	if (!previous || previous === selected.parent) {
		if (selected.title.length === 0) {
			Tree.deleteSelected(tree);
		}
		return;
	}
	// If the previous node is collapsed, it would be confusing to allow a "backspaceAtBeginning" to happen.
	if (!previous.collapsed) {
		var childNum = Tree.findChildNum(selected);
		selected.parent.childNodes.splice(childNum, 1);
		let root = Tree.getRoot(tree);
		root.selected = previous.uuid;
		root.caretLoc = previous.title.length;
		previous.title += selected.title;
		Tree.setChildNodes(previous, selected.childNodes);
		previous.collapsed = selected.collapsed;
	} else if (selected.title.length === 0) {
		Tree.deleteSelected(tree);
	}
	Tree.addDiff(selected.parent);
	Tree.addDiff(previous);
};

Tree.setChildNodes = function(tree, childNodes) {
	// TODO is there a way to stop anyone from explicitly setting childNodes?
	// We want that because if anyone ever sets childNodes, they should also set the parent
	// of the children
	// Or is there a way to have implicit parents?
	tree.childNodes = childNodes;
	for (let i = 0; i < childNodes.length; i++) {
		childNodes[i].parent = tree;
	}
};

Tree.findDeepest = function(tree) {
	var completedHidden = Tree.isCompletedHidden(tree);
	if (tree.childNodes && !tree.collapsed) {
		for (var i = tree.childNodes.length - 1; i >= 0; i--) {
			if (!completedHidden || !tree.childNodes[i].completed) {
				return Tree.findDeepest(tree.childNodes[i]);
			}
		}
	}
	return tree;
};

Tree.findSelected = function(node) {
	var root = Tree.getRoot(node);
	console.assert(root === node);
	if (!root.selected) {
		return null;
	}
	return root.uuidMap[root.selected];
};

Tree.collapseCurrent = function(tree) {
	var selected = Tree.findSelected(tree);
	if (selected.childNodes && selected.childNodes.length > 0) {
		selected.collapsed = !selected.collapsed;
	}
	Tree.addAllDiff(selected);
};

Tree.countVisibleChildren = function(tree) {
	return tree.childNodes.filter(function(n) {
		return !n.completed;
	}).length;
};

Tree.completeCurrent = function(tree) {
	var selected = Tree.findSelected(tree);
	var root = Tree.getRoot(tree);
	if (root.zoom === selected) {
		return;
	}
	if (!selected.completed && selected.parent.title === 'special_root_title') {
		if (Tree.countVisibleChildren(selected.parent) <= 1) {
			return; // Can't select the only element left on the page..
		} else if (Tree.findChildNum(selected) === 0) {
			selected.completed = true;
			let backup = Tree.isCompletedHidden(tree);
			Tree.setCompletedHidden(tree, true);
			var next = Tree.findNextNode(selected.parent);
			Tree.setCompletedHidden(tree, backup);
			root.selected = next.uuid;
			return;
		}
	}
	selected.completed = !selected.completed;

	// Make sure to get off the current node. Particularly necessary if completion turns the node hidden.
	if (selected.completed) {
		let backup = Tree.isCompletedHidden(tree);
		Tree.selectPreviousNode(tree);
		Tree.setCompletedHidden(tree, true);
		Tree.selectNextNode(tree);
		Tree.setCompletedHidden(tree, backup);
	}
	Tree.addAllDiff(selected);
};

Tree.findPreviousNode = function(tree) {
	if (!tree || !tree.parent) {
		return null;
	}
	var root = Tree.getRoot(tree);
	if (root.zoom === tree) {
		return;
	}
	var completedHidden = Tree.isCompletedHidden(tree);
	for (var childNum = Tree.findChildNum(tree) - 1; childNum >= 0; childNum--) {
		if (!completedHidden || !tree.parent.childNodes[childNum].completed) {
			return Tree.findDeepest(tree.parent.childNodes[childNum]);
		}
	}

	if (tree.parent.title === 'special_root_title') {
		return null;
	}
	return tree.parent;
};

Tree.findNextNode = function(tree) {
	var root = Tree.getRoot(tree);
	var completedHidden = Tree.isCompletedHidden(tree);
	if (
		tree.childNodes &&
    tree.childNodes.length > 0 &&
    (!tree.collapsed || root.zoom === tree)
	) {
		for (var i = 0; i < tree.childNodes.length; i++) {
			if (!completedHidden || !tree.childNodes[i].completed) {
				return tree.childNodes[i];
			}
		}
	}
	return Tree.findNextNodeRec(tree, root.zoom);
};

Tree.findNextNodeRec = function(tree, zoom) {
	if (!tree || !tree.parent) {
		return null;
	}
	if (tree === zoom) {
		return null;
	}
	var completedHidden = Tree.isCompletedHidden(tree);
	for (
		var childNum = Tree.findChildNum(tree) + 1;
		childNum < tree.parent.childNodes.length;
		childNum++
	) {
		if (!completedHidden || !tree.parent.childNodes[childNum].completed) {
			return tree.parent.childNodes[childNum];
		}
	}
	return Tree.findNextNodeRec(tree.parent, zoom);
};

Tree.makeTree = function(nodes) {
	var ret = { title: 'special_root_title', parent: null, childNodes: nodes };
	ret = Tree.clone(ret);
	ret.zoom = ret;
	ret.zoomUUID = ret.uuid;
	ret.diff = {};
	ret.completedHidden = true;
	ret.selectedNodes = [];
	//ret.selected = ret.childNodes[0].uuid; // TODO check if needed?
	return ret;
};

Tree.makeDefaultTree = function() {
	var rawStartTree = [
		{
			title: 'goody',
			childNodes: [
				{ title: 'billy' },
				{
					title: 'suzie',
					childNodes: [
						{
							title: 'puppy',
							childNodes: [{ title: 'dog house' }]
						},
						{ title: 'cherry thing' }
					]
				}
			]
		}
	];
	rawStartTree.push({ title: 'the end' });
	var ret = Tree.makeTree(rawStartTree);
	return ret;
};

Tree.findFromIndexer = function(tree, indexer) {
	if (indexer.length <= 1) {
		return tree;
	}
	var parts = indexer.substr(1).split('-');
	for (var i = 0; i < parts.length; i++) {
		tree = tree.childNodes[parts[i]];
	}
	return tree;
};

Tree.toString = function(tree) {
	tree = Tree.cloneNoParent(tree);
	return JSON.stringify(tree);
};

Tree.toStringPretty = function(tree) {
	tree = Tree.cloneNoParent(tree);
	return JSON.stringify(tree, null, 2);
};

Tree.toStringClean = function(tree) {
	tree = Tree.cloneNoParentClean(tree);
	return JSON.stringify(tree);
};

Tree.fromString = function(s) {
	var obj = JSON.parse(s);
	var ret = Tree.clone(obj);
	if (!ret.zoomUUID) {
		ret.zoom = ret;
	} else {
		ret.zoom = ret.uuidMap[ret.zoomUUID];
	}
	return ret;
};

Tree.equals = function(one, two) {
	return Tree.toString(one) === Tree.toString(two);
};

Tree.toOutline = function(tree) {
	var ret = {
		text: tree.title,
		_children: tree.childNodes.map(function(node) {
			return Tree.toOutline(node);
		})
	};

	return ret;
};

Tree.setCompletedHidden = function(tree, isHidden) {
	var root = Tree.getRoot(tree);
	// TODO or assert (tree == root)
	root.completedHidden = isHidden;
};

Tree.isCompletedHidden = function(tree) {
	var root = Tree.getRoot(tree);
	return root.completedHidden;
};

// Selection management functions
Tree.isNodeSelected = function(tree, uuid) {
	var root = Tree.getRoot(tree);
	return root.selectedNodes.includes(uuid);
};

Tree.clearSelection = function(tree) {
	var root = Tree.getRoot(tree);
	root.selectedNodes = [];
	Tree.addAllDiff(root);
};

Tree.addToSelection = function(tree, uuid) {
	var root = Tree.getRoot(tree);
	if (!root.selectedNodes.includes(uuid)) {
		root.selectedNodes.push(uuid);
		Tree.addDiff(Tree.findFromUUID(tree, uuid));
	}
};

Tree.removeFromSelection = function(tree, uuid) {
	var root = Tree.getRoot(tree);
	var index = root.selectedNodes.indexOf(uuid);
	if (index !== -1) {
		root.selectedNodes.splice(index, 1);
		Tree.addDiff(Tree.findFromUUID(tree, uuid));
	}
};

Tree.toggleSelection = function(tree, uuid) {
	if (Tree.isNodeSelected(tree, uuid)) {
		Tree.removeFromSelection(tree, uuid);
	} else {
		Tree.addToSelection(tree, uuid);
	}
};

Tree.selectNodesBetween = function(tree, startUuid, endUuid) {
	var root = Tree.getRoot(tree);
	var flattenedNodes = Tree.flattenVisibleNodes(root);
	var startIndex = -1;
	var endIndex = -1;
	
	// Find indices of start and end nodes
	for (var i = 0; i < flattenedNodes.length; i++) {
		if (flattenedNodes[i].uuid === startUuid) {
			startIndex = i;
		}
		if (flattenedNodes[i].uuid === endUuid) {
			endIndex = i;
		}
	}
	
	// Ensure start is before end
	if (startIndex > endIndex) {
		var temp = startIndex;
		startIndex = endIndex;
		endIndex = temp;
	}
	
	// Clear existing selection
	Tree.clearSelection(tree);
	
	// Add all nodes between start and end (inclusive) to selection
	for (var i = startIndex; i <= endIndex; i++) {
		Tree.addToSelection(tree, flattenedNodes[i].uuid);
	}
};

Tree.flattenVisibleNodes = function(tree) {
	var result = [];
	var completedHidden = Tree.isCompletedHidden(tree);
	
	function traverse(node) {
		if (completedHidden && node.completed && node !== tree.zoom) {
			return;
		}
		
		result.push(node);
		
		if (node.childNodes && (!node.collapsed || node === tree.zoom)) {
			for (var i = 0; i < node.childNodes.length; i++) {
				traverse(node.childNodes[i]);
			}
		}
	}
	
	traverse(tree.zoom);
	return result;
};

Tree.recSearch = function(tree, query) {
	var newTree = { title: tree.title, childNodes: [] };
	for (var i = 0; i < tree.childNodes.length; i++) {
		if (Tree.recSearch(tree.childNodes[i], query)) {
			//console.log('push on', tree.childNodes[i].title);
			newTree.childNodes.push(Tree.recSearch(tree.childNodes[i], query));
		}
	}
	if (newTree.childNodes.length === 0) {
		if (tree.title.indexOf(query) > -1) {
			//console.log('yeahh', tree.title, query);
			return { title: tree.title, childNodes: [] };
		}
		return null;
	}
	return newTree;
};

Tree.search = function(tree, query) {
	var ret = Tree.recSearch(tree, query);
	if (ret) {
		return Tree.makeTree(ret.childNodes);
	}
	return Tree.makeTree();
};

Tree.yamlObjToTree = function(obj) {
	var ret = [];
	for (var i = 0; i < obj.length; i++) {
		if (obj[i + 1] instanceof Array) {
			ret.push({ title: obj[i], childNodes: Tree.yamlObjToTree(obj[i + 1]) });
			i += 1;
		} else if (typeof obj[i] === 'object' && obj[i].hasOwnProperty('title')) {
			ret.push(obj[i]);
		} else {
			ret.push({ title: obj[i] });
		}
	}
	return ret;
};
