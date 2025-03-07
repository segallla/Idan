const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');
const crypto = require('crypto'); // Built-in module for generating random IDs

// Load environment variables from .env file
try {
    require('dotenv').config();
    console.log('Environment variables loaded from .env file');
} catch (error) {
    console.log('No .env file found, using environment variables from the system');
}

// Using the API key from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Check if API key is available
if (!OPENAI_API_KEY) {
    console.error('ERROR: OpenAI API key is missing. Set the OPENAI_API_KEY environment variable.');
    process.exit(1);
}

// Update the port configuration to work with cloud providers
const PORT = process.env.PORT || 3000;
console.log(`Using port ${PORT}`);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Created uploads directory at ${uploadDir}`);
    }
} catch (err) {
    console.error('Error creating uploads directory:', err);
}

// Utility function to read files
const readFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    });
};

// Utility function to get POST data
const getPostData = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', (err) => {
            reject(err);
        });
    });
};

// Utility function to make API requests to OpenAI
const callOpenAI = async (messages) => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: 'gpt-4o',
            messages,
            temperature: 0.7,
            max_tokens: 800
        });

        const options = {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve(parsedData);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS request (for CORS preflight)
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Log requests to help with debugging
    console.log(`Request received: ${req.method} ${pathname}`);

    // Handle API endpoints
    if (req.method === 'POST' && pathname === '/api/company-info') {
        try {
            const data = await getPostData(req);
            
            if (!data.companyName) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Company name is required' }));
                return;
            }
            
            const systemPrompt = `You are a business analyst providing information about companies. 
            Give a comprehensive analysis of ${data.companyName} including: 
            1. A brief summary of what the company does
            2. Their major clients/customers
            3. Approximate team size/number of employees
            4. Headquarters location and global presence
            5. Most recent valuation or market cap if public
            
            Format your response in clear sections with headings.
            If you're uncertain about specific details, acknowledge that and provide the most reliable information available.`;

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Tell me about ${data.companyName}` }
            ];
            
            const response = await callOpenAI(messages);
            
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
                success: true, 
                data: response.choices[0].message.content 
            }));
        } catch (error) {
            console.error('Error:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
                success: false, 
                error: 'Failed to fetch company information' 
            }));
        }
    }
    else if (req.method === 'POST' && pathname === '/api/followup') {
        try {
            const data = await getPostData(req);
            
            if (!data.companyName || !data.question) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Company name and question are required' }));
                return;
            }
            
            const systemPrompt = `You are a business analyst providing information about companies.
            The user has already received general information about ${data.companyName} and now has a specific follow-up question.
            Answer their question about ${data.companyName} with specific, factual information.
            If you're uncertain about details, acknowledge that and provide the most reliable information available.`;

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `About ${data.companyName}: ${data.question}` }
            ];
            
            const response = await callOpenAI(messages);
            
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
                success: true, 
                data: response.choices[0].message.content 
            }));
        } catch (error) {
            console.error('Error:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
                success: false, 
                error: 'Failed to fetch follow-up information'
            }));
        }
    }
    else if (req.method === 'POST' && pathname === '/api/upload') {
        try {
            // Create a random boundary for multipart data parsing
            const contentType = req.headers['content-type'] || '';
            const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
            
            if (!boundaryMatch) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'Invalid content type, missing boundary'
                }));
                return;
            }
            
            const boundary = boundaryMatch[1] || boundaryMatch[2];
            let body = [];
            let fileInfos = [];
            
            // Handle incoming data
            req.on('data', (chunk) => {
                body.push(chunk);
            });
            
            req.on('end', async () => {
                try {
                    const data = Buffer.concat(body);
                    const filePromises = parseMultipartFormData(data, boundary);
                    
                    // Process all files
                    fileInfos = await Promise.all(filePromises);
                    
                    // Send success response
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ 
                        success: true,
                        message: `Successfully uploaded ${fileInfos.filter(file => file).length} file(s)`,
                        files: fileInfos.filter(file => file) // Filter out null values
                    }));
                } catch (err) {
                    console.error('Error processing files:', err);
                    res.statusCode = 500;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ 
                        success: false, 
                        error: 'Failed to process uploaded files'
                    }));
                }
            });
            
            // Parse multipart form data
            function parseMultipartFormData(data, boundary) {
                const boundaryBuffer = Buffer.from(`--${boundary}`);
                const endingBuffer = Buffer.from(`--${boundary}--`);
                const lineBreakBuffer = Buffer.from('\r\n\r\n');
                
                let startIndex = data.indexOf(boundaryBuffer);
                const filePromises = [];
                
                // While we have boundaries
                while (startIndex !== -1) {
                    // Find the next boundary
                    let endIndex = data.indexOf(boundaryBuffer, startIndex + boundaryBuffer.length);
                    if (endIndex === -1) {
                        // Check if it's the ending boundary
                        endIndex = data.indexOf(endingBuffer, startIndex + boundaryBuffer.length);
                        if (endIndex === -1) break;
                    }
                    
                    // Get the content between boundaries
                    const partData = data.slice(startIndex + boundaryBuffer.length + 2, endIndex);
                    
                    // Find the header end
                    const headerEndIndex = partData.indexOf(lineBreakBuffer);
                    if (headerEndIndex !== -1) {
                        const headerData = partData.slice(0, headerEndIndex).toString();
                        
                        // Check if this part is a file
                        if (headerData.includes('filename=')) {
                            // Extract filename
                            const filenameMatch = headerData.match(/filename="([^"]+)"/);
                            const contentTypeMatch = headerData.match(/Content-Type: ([^\r\n]+)/);
                            
                            if (filenameMatch && filenameMatch[1]) {
                                const originalFilename = filenameMatch[1];
                                const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
                                
                                // Get the file data
                                const fileData = partData.slice(headerEndIndex + lineBreakBuffer.length);
                                
                                // Create unique filename
                                const uniqueFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${originalFilename}`;
                                const filePath = path.join(uploadDir, uniqueFilename);
                                
                                // Save the file
                                const filePromise = saveFile(filePath, fileData)
                                    .then(() => {
                                        // Return file info
                                        return {
                                            originalName: originalFilename,
                                            storedName: uniqueFilename,
                                            size: fileData.length,
                                            type: contentType
                                        };
                                    })
                                    .catch(err => {
                                        console.error('Error saving file:', err);
                                        return null;
                                    });
                                
                                filePromises.push(filePromise);
                            }
                        }
                    }
                    
                    // Move to the next boundary
                    startIndex = endIndex;
                }
                
                return filePromises;
            }
            
            // Function to save a file
            function saveFile(filePath, data) {
                return new Promise((resolve, reject) => {
                    fs.writeFile(filePath, data, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            }
        } catch (error) {
            console.error('File upload error:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
                success: false, 
                error: 'File upload failed'
            }));
        }
        return;
    }
    // Serve static files
    else {
        try {
            let filePath = '';
            // Clean up pathname by removing leading slash
            const cleanPath = pathname.replace(/^\/+/, '');
            
            if (pathname === '/' || pathname === '/index.html') {
                filePath = path.join(__dirname, 'index.html');
            } else {
                filePath = path.join(__dirname, cleanPath);
            }
            
            console.log(`Attempting to serve file: ${filePath}`);
            
            // Check if file exists
            try {
                await fs.promises.access(filePath);
            } catch (error) {
                console.error(`File not found: ${filePath}`);
                res.statusCode = 404;
                res.end(`File not found: ${cleanPath}`);
                return;
            }
            
            // Determine content type
            const extname = path.extname(filePath);
            let contentType = 'text/html';
            
            switch (extname) {
                case '.js':
                    contentType = 'text/javascript';
                    break;
                case '.css':
                    contentType = 'text/css';
                    break;
                case '.json':
                    contentType = 'application/json';
                    break;
                case '.png':
                    contentType = 'image/png';
                    break;
                case '.jpg':
                case '.jpeg':
                    contentType = 'image/jpeg';
                    break;
                case '.gif':
                    contentType = 'image/gif';
                    break;
                case '.mp4':
                    contentType = 'video/mp4';
                    break;
            }
            
            // Handle binary files (images, videos)
            if (contentType.startsWith('image/') || contentType.startsWith('video/')) {
                fs.readFile(filePath, (err, data) => {
                    if (err) {
                        console.error('Error reading file:', err);
                        res.statusCode = 500;
                        res.end('Server Error');
                        return;
                    }
                    console.log(`Successfully read binary file: ${filePath}`);
                    res.setHeader('Content-Type', contentType);
                    res.end(data);
                });
            } else {
                // Read and serve the file as text
                fs.readFile(filePath, 'utf8', (err, content) => {
                    if (err) {
                        console.error('Error reading file:', err);
                        res.statusCode = 500;
                        res.end('Server Error');
                        return;
                    }
                    console.log(`Successfully read text file: ${filePath}`);
                    res.setHeader('Content-Type', contentType);
                    res.end(content);
                });
            }
        } catch (error) {
            console.error('Error serving file:', error);
            res.statusCode = 500;
            res.end('Server Error');
        }
    }
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
}); 