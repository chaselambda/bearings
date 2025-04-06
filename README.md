# Bearings
A workflowy clone.

# Demo
[http://theicfire.github.io/bearings](http://theicfire.github.io/bearings)
This is still in active development, so I have yet to provide instructions on how to use the demo. Here's some brief things that'll be useful.

### Keymap:
- **ctrl+shift up/down** Move items up/down
- **ctrl+end/home** go to start/end
- **ctrl right/left** Zoom in/out
- **ctrl + enter** Complete item
- **ctrl + space** expand/contract
- **ctrl + s** Output a dialog of the OPML of the bullet and its children. Can be pasted directly to workflowy.
- **ctrl + shift + backspace** Delete item and children
- **ctrl z/y** undo/redo (Notice not cmd at the moment)
- **tab / shift-tab** indent/unindent

### Import and Saving
Currently, I have Parse set up to persist my data. The demo does not have this set up. Instructions coming soon. This means that the "import" link won't be useful, because the data has no where to be imported to.

# Missing features
- For multiline entries that wrap, the cursor doesn't move between lines but instead goes to the next/previous bullet
- Text formatting (links, bold, etc) doesn't work
- Large single pages are slow because there's no virtual scrolling. The entire page is rendered.

# Installation
```sh
$ npm install
$ make init_config
$ make index
(Open a new terminal)
$ make import
(Open a new terminal)
$ python -m SimpleHTTPServer (python -m http.server for python3)
Visit localhost:8000
```

# Running tests
```sh
$ npm test
```

:D
