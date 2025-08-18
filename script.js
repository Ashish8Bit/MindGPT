document.addEventListener('DOMContentLoaded', () => {
    const postGeneratorForm = document.getElementById('post-generator-form');
    const postOutput = document.getElementById('post-output');
    const resultContainer = document.getElementById('result-container');
    const copyButton = document.getElementById('copy-button');
    const searchLinksContainer = document.getElementById('search-links-container');
    const searchLinksList = document.getElementById('search-links-list');
    const userPromptText = document.getElementById('user-prompt-text');
    const generateButton = postGeneratorForm.querySelector('button[type="submit"]');
    const topicTextarea = document.getElementById('post-topic');
    const historyList = document.getElementById('history-list');
    const clearHistoryButton = document.getElementById('clear-history-button');
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const favicon = document.getElementById('favicon');

    // --- HISTORY MANAGEMENT ---
    let history = [];

    const renderSearchQueries = (queries) => {
        searchLinksList.innerHTML = '';
        if (!queries || queries.length === 0) {
            searchLinksContainer.style.display = 'none';
            return;
        }

        queries.forEach(query => {
            const link = document.createElement('a');
            link.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            link.textContent = query;
            link.target = '_blank'; // Open in new tab
            link.rel = 'noopener noreferrer'; // Security best practice
            searchLinksList.appendChild(link);
        });
        searchLinksContainer.style.display = 'block';
    };

    postGeneratorForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const topic = document.getElementById('post-topic').value;
        const tone = document.getElementById('post-tone').value;

        if (!topic.trim()) {
            alert('Please enter a topic or question.');
            return;
        }

        // Show loading state on the generate button
        generateButton.classList.add('loading');
        generateButton.disabled = true;
        resultContainer.style.display = 'none';
        copyButton.style.display = 'none';
        searchLinksContainer.style.display = 'none'; // Hide previous links
        
        try {
            const response = await fetch('http://localhost:3000/generate-post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    topic: topic, 
                    style: tone // The backend API expects 'style'
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Use the error from the server response body if it exists
                throw new Error(data.error || 'An unknown server error occurred.');
            }

            // Display the result
            userPromptText.textContent = `Your prompt: ${topic}`;
            postOutput.textContent = data.responseText;
            resultContainer.style.display = 'block';
            copyButton.style.display = 'inline-block'; // Show the copy button along with the result

            // Render search queries
            renderSearchQueries(data.searchQueries);

            // Add to history
            const historyEntry = {
                id: Date.now(),
                topic: topic,
                tone: tone,
                responseText: data.responseText,
                searchQueries: data.searchQueries || []
            };
            addToHistory(historyEntry);
        } catch (error) {
            console.error('Fetch Error:', error);
            postOutput.textContent = `Failed to generate response. Error: ${error.message}. Please make sure the server is running and check the console for more details.`;
            resultContainer.style.display = 'block';
        } finally {
            // Hide loading state
            generateButton.classList.remove('loading');
            generateButton.disabled = false;
        }
    });

    // Add click event listener for the copy button
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(postOutput.textContent).then(() => {
            copyButton.textContent = 'Copied!';
            setTimeout(() => { copyButton.textContent = 'Copy'; }, 2000);
        }).catch(err => {
            console.error('Error copying text: ', err);
            alert('Failed to copy text.');
        });
    });

    // Add keydown event listener to the textarea to submit on "Enter"
    topicTextarea.addEventListener('keydown', (e) => {
        // Check if the Enter key is pressed without the Shift key
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent the default action (adding a new line)
            generateButton.click(); // Programmatically click the generate button
        }
    });

    const saveHistory = () => {
        localStorage.setItem('ai-assistant-history', JSON.stringify(history));
    };

    const renderHistory = () => {
        historyList.innerHTML = ''; // Clear existing list
        if (history.length === 0) {
            historyList.innerHTML = '<p class="no-history">Your generation history will appear here.</p>';
            return;
        }

        history.forEach(entry => {
            const item = document.createElement('div');
            item.classList.add('history-item');

            // Truncate topic to 25 characters for display in the sidebar
            const displayTopic = entry.topic.length > 25
                ? entry.topic.substring(0, 25) + '...'
                : entry.topic;
            item.textContent = displayTopic;
            item.setAttribute('data-id', entry.id);
            item.setAttribute('title', entry.topic); // Tooltip for long text

            item.addEventListener('click', () => {
                // When a history item is clicked, display its content
                userPromptText.textContent = `Your prompt: ${entry.topic}`;
                postOutput.textContent = entry.responseText;
                resultContainer.style.display = 'block';
                copyButton.style.display = 'inline-block';

                // Render search queries from history
                renderSearchQueries(entry.searchQueries);

                // Also, populate the form with the original inputs
                topicTextarea.value = entry.topic;
                document.getElementById('post-tone').value = entry.tone;
            });
            historyList.appendChild(item);
        });
    };

    const loadHistory = () => {
        const savedHistory = localStorage.getItem('ai-assistant-history');
        if (savedHistory) {
            history = JSON.parse(savedHistory);
        }
        renderHistory();
    };

    const addToHistory = (entry) => {
        // Add new items to the top
        history.unshift(entry);
        saveHistory();
        renderHistory();
    };

    clearHistoryButton.addEventListener('click', () => {
        history = [];
        saveHistory();
        renderHistory();
    });

    // --- THEME MANAGEMENT ---
    const updateFavicon = (theme) => {
        if (favicon) {
            favicon.href = theme === 'dark' ? 'assests/MindGPT-white.ico' : 'assests/MindGPT.ico';
        }
    };

    const updateThemeButton = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (themeToggleButton) {
            themeToggleButton.textContent = currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
            themeToggleButton.title = `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`;
        }
    };

    themeToggleButton.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('ai-assistant-theme', newTheme);
        updateThemeButton();
        updateFavicon(newTheme);
    });

    // --- INITIALIZATION ---
    loadHistory();
    updateThemeButton();
    // The inline script in index.html handles the initial load to prevent FOUC.
    // This call ensures consistency if the logic were to change.
    updateFavicon(document.documentElement.getAttribute('data-theme'));
});