var React = require('react/addons');
var cheerio = require('cheerio');
var opmlToJSON = require('opml-to-json');
var multiline = require('multiline');
var Tree = require('./lib/Tree');
var Convert = require('./lib/Convert');
var config = require('./config');
var ImportUtils = require('./lib/ImportUtils');
var FakeParseTree = require('./lib/FakeParseTree');

var parseTree;
var query;

if (config.use_parse) {
	var Parse = require('parse').Parse;
	Parse.initialize(config.parse_app_id, config.parse_js_key);
	var First = Parse.Object.extend('first');
	query = new Parse.Query(First);
}

var SubmitButton = React.createClass({
	getInitialState: function() {
		return { value: '' };
	},
	render: function() {
		var value = this.state.value;
		return (
			<div>
				<div>
					<textarea
						id="text"
						onChange={this.handleChange}
						rows="20"
						cols="100"
					/>
				</div>
				<button value={value} onClick={this.handleClick}>
          Import opml
				</button>
				<button value={value} onClick={this.handleHtmlClick}>
          Import html
				</button>
			</div>
		);
	},
	handleClick: function() {
		console.log('clicked', this.state.value);
		submitOpml(this.state.value);
	},
	handleHtmlClick: function() {
		var tree = Tree.makeTree(Convert.htmlToTree(this.state.value));
		console.log('Importing HTML tree');
		
		if (config.use_parse) {
			console.log('Saving to Parse', config.parse_id);
			query.get(config.parse_id, {
				success: function(parseTree) {
					console.log('Saving tree', Tree.toString(tree));
					parseTree.set('tree', Tree.toString(tree));
					parseTree.save();
				},
				error: function(obj, error) {
					console.log(error);
					throw 'Error loading tree' + obj + error;
				}
			});
		} else {
			// Save to localStorage
			console.log('Saving to localStorage');
			localStorage.setItem('bearings_tree', Tree.toString(tree));
			alert('Tree imported successfully to localStorage!');
		}
	},
	handleChange: function(event) {
		this.setState({ value: event.target.value });
	}
});

var sampleHtml = multiline(function() {
/*
<meta http-equiv="content-type" content="text/html; charset=utf-8">
<ul style="margin: 15px 0px 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; list-style: disc; color: rgb(51, 51, 51); font-family: 'Helvetica Neue', Arial, sans-serif; font-style: normal; font-variant: normal; font-weight: normal; letter-spacing: normal; line-height: 17px; orphans: auto; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; widows: 1; word-spacing: 0px; -webkit-text-stroke-width: 0px; background: transparent;">
   <li style="margin: 4px 0px 4px 20px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; background: transparent;">
      <span class="name" data-wfid="e3ea4e756ce1" style="margin: 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; white-space: pre-wrap; background: transparent;">one</span>
      <ul style="margin: 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; list-style: disc; background: transparent;">
         <li style="margin: 4px 0px 4px 20px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; background: transparent;"><span class="name" style="margin: 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; white-space: pre-wrap; background: transparent;">two</span></li>
         <li style="margin: 4px 0px 4px 20px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; background: transparent;">
            <span class="name" style="margin: 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; white-space: pre-wrap; background: transparent;">three</span>
            <ul style="margin: 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; list-style: disc; background: transparent;">
               <li style="margin: 4px 0px 4px 20px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; background: transparent;">
                  <span class="name" style="margin: 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; white-space: pre-wrap; background: transparent;">four</span>
                  <ul style="margin: 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; list-style: disc; background: transparent;">
                     <li style="margin: 4px 0px 4px 20px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; background: transparent;"><span class="name" style="margin: 0px; padding: 0px; border: 0px; outline: 0px; font-size: 13px; vertical-align: baseline; white-space: pre-wrap; background: transparent;">five</span></li>
                  </ul>
               </li>
            </ul>
         </li>
      </ul>
   </li>
</ul>
*/
});

const $ = cheerio.load(sampleHtml);
//console.log($('span').eq(0));
console.log(JSON.stringify(printAll($('ul').eq(0)), null, '   '));

React.render(<SubmitButton />, document.getElementById('all'));

function printAll(objs) {
	var ret = [];
	objs.each(function(i, el) {
		//console.log('name', el.name, 'type', el.type);
		if (el.name === 'span') {
			ret.push($(this).text());
		} else {
			//console.log('el', $(this));
			ret.push(printAll($(this).children()));
		}
	});
	return ret;
}

function submitOpml(opml) {
	console.log('submit', opml, 'useparse', config.use_parse);
	
	if (config.use_parse) {
		query.get(config.parse_id, {
			success: function(parseTree) {
				opmlToJSON(opml, function(error, json) {
					var tree = Tree.makeTree(ImportUtils.workflowyToWorkclone(json));
					console.log('tree', Tree.toString(tree));
					parseTree.set('tree', Tree.toString(tree));
					parseTree.save();
				});
			},
			error: function(obj, error) {
				throw 'Error loading tree' + obj + error;
			}
		});
	} else {
		// Save to localStorage
		opmlToJSON(opml, function(error, json) {
			if (error) {
				console.error('Error parsing OPML:', error);
				alert('Error parsing OPML: ' + error);
				return;
			}
			
			var tree = Tree.makeTree(ImportUtils.workflowyToWorkclone(json));
			console.log('Saving tree to localStorage', Tree.toString(tree));
			localStorage.setItem('bearings_tree', Tree.toString(tree));
			alert('Tree imported successfully to localStorage!');
		});
	}
}
