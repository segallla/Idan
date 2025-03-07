document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const companyForm = document.getElementById('company-form');
    const companyInput = document.getElementById('company-name');
    const searchBtn = document.getElementById('search-btn');
    const companyInfo = document.getElementById('company-info');
    const followupContainer = document.getElementById('followup-container');
    const followupForm = document.getElementById('followup-form');
    const followupQuestion = document.getElementById('followup-question');
    const followupResponse = document.getElementById('followup-response');
    const resultsContainer = document.getElementById('results-container');
    const loader = document.getElementById('loader');
    
    // Current company context
    let currentCompany = '';

    // Hide results container initially
    resultsContainer.style.display = 'none';
    
    // Handle company search form submission
    companyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const companyName = companyInput.value.trim();
        if (!companyName) return;
        
        // Store current company
        currentCompany = companyName;
        
        // Clear previous results
        companyInfo.innerHTML = '';
        followupResponse.innerHTML = '';
        followupContainer.classList.add('hidden');
        
        // Show loading indicator
        toggleLoader(true);
        
        try {
            const response = await fetchCompanyInfo(companyName);
            
            if (response.success) {
                // Format and display the company information
                displayCompanyInfo(response.data, companyName);
                
                // Show the followup container
                followupContainer.classList.remove('hidden');
                
                // Show results container
                resultsContainer.style.display = 'block';
            } else {
                displayError('Failed to fetch company information. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            displayError('An error occurred. Please try again later.');
        } finally {
            toggleLoader(false);
        }
    });
    
    // Handle follow-up question form submission
    followupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const question = followupQuestion.value.trim();
        if (!question || !currentCompany) return;
        
        // Clear previous followup response
        followupResponse.innerHTML = '';
        
        // Show loading indicator
        toggleLoader(true);
        
        try {
            const response = await fetchFollowup(currentCompany, question);
            
            if (response.success) {
                displayFollowupResponse(response.data, question);
            } else {
                displayError('Failed to fetch answer. Please try again.', followupResponse);
            }
        } catch (error) {
            console.error('Error:', error);
            displayError('An error occurred. Please try again later.', followupResponse);
        } finally {
            toggleLoader(false);
            followupQuestion.value = ''; // Clear the question input
        }
    });
    
    // Fetch company information from the server
    async function fetchCompanyInfo(companyName) {
        const response = await fetch('http://localhost:3000/api/company-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ companyName })
        });
        
        return await response.json();
    }
    
    // Fetch follow-up information from the server
    async function fetchFollowup(companyName, question) {
        const response = await fetch('http://localhost:3000/api/followup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ companyName, question })
        });
        
        return await response.json();
    }
    
    // Display company information
    function displayCompanyInfo(infoText, companyName) {
        // Create header
        const header = document.createElement('h2');
        header.textContent = companyName;
        companyInfo.appendChild(header);
        
        // Format the information with sections
        const formattedInfo = formatText(infoText);
        companyInfo.appendChild(formattedInfo);

        // Add fade-in animation to each section with a delay
        const sections = companyInfo.querySelectorAll('.section');
        sections.forEach((section, index) => {
            section.style.opacity = '0';
            section.style.animation = `fadeIn 0.5s ease-in-out ${index * 0.15}s forwards`;
        });
    }
    
    // Display follow-up response
    function displayFollowupResponse(responseText, question) {
        // Create header for the question
        const header = document.createElement('h3');
        header.textContent = `Q: ${question}`;
        followupResponse.appendChild(header);
        
        // Format the response
        const formattedResponse = formatText(responseText);
        followupResponse.appendChild(formattedResponse);

        // Add animation to the response
        followupResponse.style.animation = 'fadeIn 0.5s ease-in-out';
    }
    
    // Format text with proper HTML structure
    function formatText(text) {
        const container = document.createElement('div');
        
        // Split by newlines and create paragraphs
        const paragraphs = text.split('\n\n');
        
        let currentSection = null;
        let firstParagraph = true;
        
        paragraphs.forEach(paragraph => {
            if (paragraph.trim() === '') return;
            
            // Check if it's a heading (starts with # or contains a number followed by a period)
            const isHeading = paragraph.trim().startsWith('#') || /^\d+\./.test(paragraph.trim()) || 
                            paragraph.includes(':') && paragraph.split(':')[0].length < 30;
            
            if (isHeading) {
                // If this is a new section, create a section container
                currentSection = document.createElement('div');
                currentSection.className = 'section';
                container.appendChild(currentSection);
                
                const heading = document.createElement('div');
                heading.className = 'section-title';
                
                // Clean up the heading text - remove ## and other prefixes
                let headingText = paragraph.trim()
                    .replace(/^#+\s*/, '') // Remove any number of # characters at start
                    .replace(/^\d+\.\s*/, '') // Remove numbered list prefix
                    .trim();
                
                // If it's a key-value pair, just use the key as the heading
                if (headingText.includes(':')) {
                    const parts = headingText.split(':');
                    heading.textContent = parts[0].trim();
                    heading.style.fontWeight = 'bold'; // Make the heading bold
                    heading.style.color = '#000'; // Ensure heading is black
                    
                    // Create a paragraph for the value with non-bold black text
                    if (parts[1] && parts[1].trim()) {
                        const valuePara = document.createElement('p');
                        valuePara.textContent = parts[1].trim();
                        valuePara.style.fontWeight = 'normal'; // Make answer text not bold
                        valuePara.style.color = '#000'; // Make answer text black
                        currentSection.appendChild(heading);
                        currentSection.appendChild(valuePara);
                        return;
                    }
                } else {
                    heading.textContent = headingText;
                    heading.style.fontWeight = 'bold'; // Make the heading bold
                    heading.style.color = '#000'; // Ensure heading is black
                }
                
                currentSection.appendChild(heading);
            } else {
                // For the first paragraph (company description)
                if (firstParagraph && !currentSection) {
                    const descriptionDiv = document.createElement('div');
                    descriptionDiv.className = 'company-description';
                    descriptionDiv.textContent = paragraph.trim();
                    descriptionDiv.style.color = '#000'; // Make text black
                    container.appendChild(descriptionDiv);
                    firstParagraph = false;
                    return;
                }
                
                // If there's no current section, create a default one
                if (!currentSection) {
                    currentSection = document.createElement('div');
                    currentSection.className = 'section';
                    container.appendChild(currentSection);
                }
                
                // Check if the paragraph seems like a list
                if (paragraph.includes('\n- ') || paragraph.includes('\n* ')) {
                    // Create a ul element for lists
                    const ul = document.createElement('ul');
                    
                    // Split by list item markers
                    const listItems = paragraph.split(/\n[-*]\s+/);
                    
                    // Add each list item
                    listItems.forEach((item, index) => {
                        if (index === 0 && !item.trim().startsWith('-') && !item.trim().startsWith('*')) {
                            // First item might be a paragraph before the list
                            if (item.trim()) {
                                const p = document.createElement('p');
                                p.textContent = item.trim();
                                p.style.fontWeight = 'normal'; // Make answer text not bold
                                p.style.color = '#000'; // Make answer text black
                                currentSection.appendChild(p);
                            }
                            return;
                        }
                        
                        if (item.trim()) {
                            const li = document.createElement('li');
                            li.textContent = item.trim();
                            li.style.color = '#000'; // Make list items black
                            li.style.fontWeight = 'normal'; // Make list items not bold
                            ul.appendChild(li);
                        }
                    });
                    
                    if (ul.children.length > 0) {
                        currentSection.appendChild(ul);
                    }
                } else {
                    // Regular paragraph
                    const p = document.createElement('p');
                    p.textContent = paragraph.trim();
                    p.style.fontWeight = 'normal'; // Make answer text not bold
                    p.style.color = '#000'; // Make answer text black
                    currentSection.appendChild(p);
                }
            }
        });
        
        return container;
    }
    
    // Display error message
    function displayError(message, container = companyInfo) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message section';
        
        const errorIcon = document.createElement('span');
        errorIcon.innerHTML = '⚠️';
        errorIcon.style.marginRight = '10px';
        errorIcon.style.fontSize = '1.5rem';
        
        const errorMsg = document.createElement('p');
        errorMsg.textContent = message;
        
        errorDiv.appendChild(errorIcon);
        errorDiv.appendChild(errorMsg);
        
        container.innerHTML = '';
        container.appendChild(errorDiv);
        resultsContainer.style.display = 'block';
    }
    
    // Toggle loader visibility
    function toggleLoader(show) {
        if (show) {
            loader.classList.add('active');
            searchBtn.disabled = true;
        } else {
            loader.classList.remove('active');
            searchBtn.disabled = false;
        }
    }
}); 