var Tree = {};
module.exports = exports = Tree;

Tree.selectNextNode = function(tree) {
    var selected = Tree.findSelected(tree);
    var next = Tree.findNextNode(selected);
    if (next) {
        if (selected) {
            delete selected.selected;
        }
        next.selected = true;
    }
};

Tree.selectPreviousNode = function(tree) {
    var selected = Tree.findSelected(tree);
    var previous = Tree.findPreviousNode(selected);
    if (previous) {
        if (previous) {
            delete selected.selected;
        }
        previous.selected = true;
    }
};

Tree.appendSibling = function(tree, title) {
    var i;
    for (i = 0; i < tree.parent.childNodes.length; i++) {
        if (tree.parent.childNodes[i] == tree) {
            break;
        }
    }
    var ret = Tree.makeNode({title: title, parent: tree.parent});
    tree.parent.childNodes.splice(i + 1, 0, ret);
    return ret;
};

Tree.newLineAtCursor = function(tree) {
    var selected = Tree.findSelected(tree);
    var start = selected.title.substr(0, selected.caretLoc);
    var rest = selected.title.substr(selected.caretLoc);
    selected.title = start;
    var nextNode = Tree.appendSibling(selected, rest);
    Tree.setChildNodes(nextNode, selected.childNodes);
    Tree.setChildNodes(selected, []);
    if (start.length > 0) {
        delete selected.selected;
        delete selected.caretLoc;
        nextNode.selected = true;
        selected = nextNode;
    }
    selected.caretLoc = 0;
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
    Tree.setIfReal(ret, args, 'parent', null);
    Tree.setIfReal(ret, args, 'caretLoc');
    Tree.setIfReal(ret, args, 'selected');
    Tree.setIfReal(ret, args, 'collapsed');
    return ret;
};

Tree.clone = function(tree, noparent) {
    return Tree.cloneGeneral(tree, null, false);
};

Tree.cloneNoParent = function(tree) {
    return Tree.cloneGeneral(tree, null, true);
};

Tree.cloneGeneral = function(tree, parent, noparent) {
    var me = Tree.makeNode({
            title: tree.title,
            parent: !!noparent ? undefined : parent,
            caretLoc: tree.caretLoc,
            selected: tree.selected,
            collapsed: tree.collapsed});
    me.childNodes = tree.childNodes.map(function (t) {return Tree.cloneGeneral(t, me, noparent)});
    return me;
};

Tree.saveAndClone = function(tree) {
    var newTree = Tree.clone(tree);
}

Tree.indent = function(tree) {
    var selected = Tree.findSelected(tree);
    var childNum = Tree.findChildNum(selected);
    if (childNum == 0) {
        return;
    }
    var newParent = selected.parent.childNodes[childNum - 1];
    newParent.childNodes.push(selected);
    selected.parent.childNodes.splice(childNum, 1);
    selected.parent = newParent;
};

Tree.unindent = function(tree) {
    var selected = Tree.findSelected(tree);
    if (!selected.parent.parent) {
        return;
    }
    var childNum = Tree.findChildNum(selected);
    var parentChildNum = Tree.findChildNum(selected.parent);
    var newParent = selected.parent.parent;
    newParent.childNodes.splice(parentChildNum + 1, 0, selected);
    selected.parent.childNodes.splice(childNum, 1);
    selected.parent = newParent;
};

Tree.setCurrentTitle = function(tree, title) {
    var selected = Tree.findSelected(tree);
    selected.title = title;
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
    parent.childNodes[childNum] = parent.childNodes[childNum - 1]
    parent.childNodes[childNum - 1] = tmp;
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
    parent.childNodes[childNum] = parent.childNodes[childNum + 1]
    parent.childNodes[childNum + 1] = tmp;
};

Tree.findChildNum = function(tree) {
    var i;
    for (i = 0; i < tree.parent.childNodes.length; i++) {
        if (tree.parent.childNodes[i] == tree) {
            return i;
        }
    }
    console.assert(false);
}

Tree.backspaceAtBeginning = function(tree) {
    var selected = Tree.findSelected(tree);
    console.assert(selected.caretLoc === 0);
    var i;
    var previous = Tree.findPreviousNode(selected);
    if (previous === selected.parent) {
        return;
    }
    var childNum = Tree.findChildNum(selected);
    selected.parent.childNodes.splice(childNum, 1);
    previous.selected = true;
    previous.caretLoc = previous.title.length;
    previous.title += selected.title;
    Tree.setChildNodes(previous, selected.childNodes);
}

Tree.setChildNodes = function(tree, childNodes) {
    // TODO is there a way to stop anyone from explicitly setting childNodes?
    // We want that because if anyone ever sets childNodes, they should also set the parent
    // of the children
    // Or is there a way to have implicit parents?
    tree.childNodes = childNodes;
    for (i = 0; i < childNodes.length; i++) {
        childNodes[i].parent = tree;
    }
}

Tree.findDeepest = function(tree) {
    if (tree.childNodes && tree.childNodes.length > 0 && !tree.collapsed) {
        return Tree.findDeepest(tree.childNodes[tree.childNodes.length - 1]);
    }
    return tree;
};

Tree.findSelected = function(node) {
    if (node.selected) {
        return node;
    }
    for (var i = 0; i < node.childNodes.length; i++) {
        var found = Tree.findSelected(node.childNodes[i]);
        if (found) {
            return found;
        }
    }
    return null;
};

Tree.findNextNode = function(tree) {
    if (tree.childNodes && tree.childNodes.length > 0 && !tree.collapsed) {
        return tree.childNodes[0];
    }
    return Tree.findNextNodeRec(tree);
};

Tree.collapseCurrent = function(tree) {
    var selected = Tree.findSelected(tree);
    if (selected.childNodes && selected.childNodes.length > 0) {
        selected.collapsed = !selected.collapsed;
    }
};

Tree.findPreviousNode = function(tree) {
    if (!tree || !tree.parent) {
        return null;
    }
    var childNum = Tree.findChildNum(tree);
    if (childNum - 1 >= 0) {
        return Tree.findDeepest(tree.parent.childNodes[childNum - 1]);
    }
    if (tree.parent.title === 'root') {
        return tree;
    }
    return tree.parent;
};

Tree.findNextNodeRec = function(tree) {
    if (!tree || !tree.parent) {
        return null;
    }
    var i = 0;
    var childNum = Tree.findChildNum(tree);
    if (childNum + 1 < tree.parent.childNodes.length) {
        return tree.parent.childNodes[childNum + 1];
    }
    return Tree.findNextNodeRec(tree.parent);
};


Tree.findPreviousNodeRec = function(tree) {
    if (!tree || !tree.parent) {
        return null;
    }
    var childNum = Tree.findChildNum(tree);
    if (childNum - 1 >= 0) {
        return tree.parent.childNodes[childNum - 1];
    }
    return Tree.findPreviousNodeRec(tree.parent);
}

Tree.makeTree = function(node, parent) {
    var me = Tree.makeNode({
            title: node.title,
            parent: parent,
            selected: node.selected,
            caretLoc: node.caretLoc});
    if (node.childNodes) {
        me.childNodes = node.childNodes.map(function (node) {
            return Tree.makeTree(node, me);
        });
    }
    return me;
};

Tree.findFromIndexer = function(tree, indexer) {
    var parts = indexer.substr(1).split('-');
    for (var i = 0; i < parts.length; i++) {
        tree = tree.childNodes[parts[i]];
    }
    return tree;
}

Tree.toString = function(tree) {
    tree = Tree.cloneNoParent(tree);
    return JSON.stringify(tree);
};
