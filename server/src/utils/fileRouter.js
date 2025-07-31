const express = require('express');
const path = require('path');
const router = express.Router();

// Define the root uploads directory path
const UPLOADS_DIRECTORY = path.resolve(__dirname, '../../uploads');

// Handle file path requests
router.get('/*', (req, res) => {
    // Get the relative file path from the URL
    const filePath = req.params[0];
    console.log(req.params[0]);
    if (!filePath) {
        return res.status(400).send('File path is required');
    }

    // Construct the absolute path to the file
    const fullPath = path.resolve(UPLOADS_DIRECTORY, filePath);

    // Ensure the path is within the uploads directory (to prevent directory traversal attacks)
    if (!fullPath.startsWith(UPLOADS_DIRECTORY)) {
        return res.status(403).send('Access denied');
    }

    // Serve the file
    res.sendFile(fullPath, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.status(404).send('File not found');
            }
        } else {
            console.log('File sent successfully');
        }
    });
    
});

module.exports = router;
