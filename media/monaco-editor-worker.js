/**
 * Monaco Editor Web Worker
 * This file is needed to properly load Monaco Editor in a VS Code webview
 */

self.MonacoEnvironment = {
    baseUrl: 'vs'
};

// Use the AMD loader from Monaco
importScripts('vs/loader.js');

// Load the web worker for Monaco
require(['vs/editor/editor.main'], function() {
    // Worker initialization complete
});

// Handle language worker requests
self.addEventListener('message', function(e) {
    // Process messages from the main thread
});
