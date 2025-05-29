// This script will be loaded in the webview context
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });

    // Run Query button
    const runButton = document.getElementById('run-query');
    if (runButton) {
        runButton.addEventListener('click', () => {
            const query = ''; // Get query from Monaco editor
            const distanceMetric = document.getElementById('distance-metric').value;
            const limit = document.getElementById('limit').value;
            const certainty = document.getElementById('certainty').value;
            
            // Show loading state
            const resultsContent = document.querySelector('.results-content');
            resultsContent.innerHTML = '<div class="loading">Running query...</div>';
            
            // In a real implementation, this would send the query to the extension host
            setTimeout(() => {
                // Simulate query results
                const mockResults = {
                    data: {
                        Get: {
                            Things: {
                                // Mock results would go here
                            }
                        }
                    }
                };
                
                // Update UI with results
                updateResults(mockResults);
            }, 1000);
        });
    }

    // Explain Plan button
    const explainButton = document.getElementById('explain-plan');
    if (explainButton) {
        explainButton.addEventListener('click', () => {
            // Show explanation in the JSON tab
            document.querySelector('.tab[data-tab="json"]').click();
            const jsonTab = document.getElementById('json-tab');
            jsonTab.innerHTML = '<pre>Query plan explanation will be shown here\n\n' +
                'This will include execution steps, performance metrics, and optimization suggestions.</pre>';
        });
    }
});

function updateResults(results) {
    // Update table view
    const tableTab = document.getElementById('table-tab');
    tableTab.innerHTML = '<p>Query results will be displayed in a table here.</p>';
    
    // Update JSON view
    const jsonTab = document.getElementById('json-tab');
    jsonTab.innerHTML = '<pre>' + JSON.stringify(results, null, 2) + '</pre>';
}
