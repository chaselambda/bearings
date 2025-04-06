var ImportUtils = {};
module.exports = exports = ImportUtils;

var Tree = require('./Tree');
var opmlToJSON = require('opml-to-json');
var multiline = require('multiline');
var _ = require('underscore');

// Export this function so it can be used by import.js
ImportUtils.workflowyToWorkclone = function(tree) {
	var ret = workflowyToWorkcloneRec(tree);
	ret.childNodes[0].selected = true;
	return ret.childNodes;
};

var workflowyToWorkcloneRec = function(tree) {
	// TODO why are there both of these? Should there not just be one? Artifact from before?
	var ret = {
		title:
      tree.title !== undefined ? _.unescape(tree.title) : _.unescape(tree.text)
	};
	if (!tree.children) {
		return ret;
	}
	ret.childNodes = [];
	for (var i = 0; i < tree.children.length; i++) {
		ret.childNodes.push(workflowyToWorkcloneRec(tree.children[i]));
	}
	return ret;
};

ImportUtils.opmlToTree = function(opml, cb) {
	opmlToJSON(opml, function(error, json) {
		cb(Tree.makeTree(ImportUtils.workflowyToWorkclone(json)));
	});
};

ImportUtils.sampleOpml = multiline(function() {
	/*
    <?xml version="1.0"?>
    <opml version="2.0">
      <head>
        <ownerEmail>theicfire@gmail.com</ownerEmail>
      </head>
      <body>
        <outline text="one" >
          <outline text="two" >
            <outline text="three" /></outline>
            <outline text="four" /></outline>
            <outline text="yay" /></outline>
        </outline>
        <outline text="five" />
        <outline text="six" />
        <outline text="seven" />
        </outline>
      </body>
    </opml>
*/
});