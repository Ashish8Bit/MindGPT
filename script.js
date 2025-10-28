document.addEventListener('DOMContentLoaded', () => {
    const postGeneratorForm = document.getElementById('post-generator-form');
    const postOutput = document.getElementById('post-output');
    const resultContainer = document.getElementById('result-container');
    const copyButton = document.getElementById('copy-button');
    const regenerateButton = document.getElementById('regenerate-button');
    const searchLinksContainer = document.getElementById('search-links-container');
    const searchLinksList = document.getElementById('search-links-list');
    const userPromptText = document.getElementById('user-prompt-text');
    const generateButton = postGeneratorForm.querySelector('button[type="submit"]');
    const topicTextarea = document.getElementById('post-topic');
    const toneSelect = document.getElementById('post-tone');
    const historyList = document.getElementById('history-list');
    const clearHistoryButton = document.getElementById('clear-history-button');
    const historySearchInput = document.getElementById('history-search-input');
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const favicon = document.getElementById('favicon');
    const menuToggleButton = document.getElementById('menu-toggle-button');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay');

    // --- API Configuration ---
    // Determine the API base URL based on the hostname to switch between local and production
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : ''; // Use a relative path for production

    // --- HISTORY MANAGEMENT ---
    let history = [];
    // Store the last successful submission for the regenerate feature
    let lastSubmission = { topic: '', tone: '' };

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

    const handleGeneration = async (isRegeneration = false) => {
        const topic = isRegeneration ? lastSubmission.topic : topicTextarea.value;
        const tone = isRegeneration ? lastSubmission.tone : toneSelect.value;

        if (!topic.trim()) {
            alert('Please enter a topic or question.');
            return;
        }

        // Show loading state on the generate button
        generateButton.classList.add('loading');
        generateButton.disabled = true;
        resultContainer.style.display = 'none';
        copyButton.style.display = 'none';
        regenerateButton.style.display = 'none';
        searchLinksContainer.style.display = 'none'; // Hide previous links
        
        try {
            const response = await fetch(`${API_BASE_URL}/generate-post`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    topic: topic, 
                    style: tone // The backend API expects 'style'
                }),
            });
    
            if (!response.ok) {
                // Handle HTTP errors (like 404, 500, etc.)
                let errorMessage;
                try {
                    // The server should send a JSON object with an 'error' key.
                    const errorData = await response.json();
                    errorMessage = errorData.error || `Server error: ${response.status}`;
                } catch (e) {
                    // If the error response isn't JSON, it's likely a Vercel crash page (HTML).
                    errorMessage = `Server responded with status ${response.status}. The response was not valid JSON. Check Vercel logs.`;
                }
                throw new Error(errorMessage);
            }
    
            // If response is OK, parse the successful JSON data.
            const data = await response.json();
    
            // Display the result
            userPromptText.textContent = `Your prompt: ${topic}`;
            postOutput.textContent = data.responseText;
            resultContainer.style.display = 'block';
            copyButton.style.display = 'inline-block';
            regenerateButton.style.display = 'inline-block';
    
            // Render search queries
            renderSearchQueries(data.searchQueries);

            // Store this successful submission for the regenerate feature
            lastSubmission.topic = topic;
            lastSubmission.tone = tone;
    
            // Add to history
            const historyEntry = {
                id: Date.now(),
                topic: topic,
                tone: tone,
                responseText: data.responseText,
                searchQueries: data.searchQueries || []
            };
            // Only add to history if it's a new generation, not a regeneration
            if (!isRegeneration) {
                addToHistory(historyEntry);
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            // The error message is now more descriptive thanks to the logic above.
            postOutput.textContent = `Failed to generate response. Error: ${error.message}`;
            resultContainer.style.display = 'block';
        } finally {
            // Hide loading state
            generateButton.classList.remove('loading');
            generateButton.disabled = false;
        }
    };

    postGeneratorForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleGeneration(false);
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

    // Add click event listener for the regenerate button
    regenerateButton.addEventListener('click', () => {
        handleGeneration(true);
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
        const searchTerm = historySearchInput.value.toLowerCase();
        historyList.innerHTML = ''; // Clear existing list

        if (history.length === 0) {
            historyList.innerHTML = '<p class="no-history">Your generation history will appear here.</p>';
            return;
        }

        const filteredHistory = history.filter(entry =>
            entry.topic.toLowerCase().includes(searchTerm)
        );

        if (filteredHistory.length === 0) {
            // This message shows if there's history but no search match
            historyList.innerHTML = '<p class="no-history">No matching history found.</p>';
            return;
        }

        filteredHistory.forEach(entry => {
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
                regenerateButton.style.display = 'inline-block';

                // Render search queries from history
                renderSearchQueries(entry.searchQueries);

                // Also, populate the form with the original inputs
                topicTextarea.value = entry.topic;
                toneSelect.value = entry.tone;
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

    historySearchInput.addEventListener('input', () => {
        renderHistory();
    });

    // --- THEME MANAGEMENT ---
    const updateFavicon = (theme) => {
        if (favicon) {
            favicon.href = theme === 'dark' ? 'assets/MindGPT-white.ico' : 'assets/MindGPT.ico';
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

    // --- MOBILE SIDEBAR MANAGEMENT ---
    const toggleSidebar = () => {
        const isSidebarOpen = sidebar.classList.contains('open');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
        menuToggleButton.classList.toggle('open');
        menuToggleButton.setAttribute('aria-expanded', !isSidebarOpen);
    };

    if (menuToggleButton && sidebar && overlay) {
        menuToggleButton.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', toggleSidebar);
    }

    // --- INITIALIZATION ---
    // Only run app-specific initializations if we are on the main page
    if (postGeneratorForm) {
        loadHistory();
        updateThemeButton();
        // The inline script in index.html handles the initial load to prevent FOUC.
        // This call ensures consistency if the logic were to change.
        updateFavicon(document.documentElement.getAttribute('data-theme'));
    } else {
        // On other pages like about.html, we might only need the theme button logic
        updateThemeButton();
        themeToggleButton.addEventListener('click', () => {
            // This is a simplified listener for pages without the full script context
            window.location.reload(); // Simple way to apply theme changes on other pages
        });
    }
});