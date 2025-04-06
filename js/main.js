var ReactTree = require('./ReactTree');
var Tree = require('./lib/Tree');
var ImportUtils = require('./lib/ImportUtils');
var config = require('./config');
var FakeParseTree = require('./lib/FakeParseTree');

if (config.use_parse) {
	var Parse = require('parse').Parse;
	Parse.initialize(config.parse_app_id, config.parse_js_key);
	var First = Parse.Object.extend('first');
	var query = new Parse.Query(First);
	query.get(config.parse_id, {
		success: function(parseTree) {
			ReactTree.startRender(parseTree);
		},
		error: function(obj, error) {
			throw 'Error loading tree' + obj + error;
		}
	});
} else {
	// Try to load from localStorage first
	var savedData = localStorage.getItem('bearings_tree');
	if (savedData) {
		try {
			var tree = Tree.fromString(savedData);
			ReactTree.startRender(new FakeParseTree(Tree.toString(tree)));
		} catch (e) {
			console.error('Failed to load saved data', e);
			// Fall back to sample data
			ImportUtils.opmlToTree(ImportUtils.sampleOpml, function(tree) {
				ReactTree.startRender(new FakeParseTree(Tree.toString(tree)));
			});
		}
	} else {
		// Load sample data if no saved data exists
		ImportUtils.opmlToTree(ImportUtils.sampleOpml, function(tree) {
			ReactTree.startRender(new FakeParseTree(Tree.toString(tree)));
		});
	}
}
