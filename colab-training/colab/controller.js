const fs = require("fs");
const path = require("path");
const multer = require("multer");

const colabDataRoot = path.join(__dirname, "../colab_data");

if (!fs.existsSync(colabDataRoot)) fs.mkdirSync(colabDataRoot, { recursive: true });

exports.storagePlot = multer.diskStorage({
    destination: (req, file, cb) => {
        const sessionId = req.query.sessionId;
        const plotDir = path.join(colabDataRoot, sessionId, "plots");
        cb(null, plotDir);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
});

exports.storageFile = multer.diskStorage({
    destination: (req, file, cb) => {
        const sessionId = req.query.sessionId;
        const relativePath = req.body.relativePath || '.';
        
        if (!sessionId) {
            return cb(new Error("Session ID is missing in query parameters"), null);
        }

        const safeRelativePath = path.normalize(relativePath).replace(/^(\.\.(?:\/|\\)|\.\.$)+/, '');
        
        const targetFolder = path.join(colabDataRoot, sessionId, safeRelativePath);

        fs.mkdirSync(targetFolder, { recursive: true });
        
        cb(null, targetFolder);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
});

exports.register = async (req, res) => {
    try {
        const sessionId = req.query.sessionId;
        const folder = path.join(colabDataRoot, sessionId);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
            fs.mkdirSync(path.join(folder, "plots"), { recursive: true });
            console.log(`Registered session: ${sessionId}`);
            res.status(200).send("Session registered");
        }
        else {
            res.status(400).send("Session already registered");
        }
    } catch (error) {
        res.status(500).send("Error registering session");
    }
};

exports.log = async (req, res) => {
    try {
        const sessionId = req.body.sessionId;
        const logName = req.body.logName;
        const content = req.body.content;

        if (!sessionId || !logName || content === undefined) {
            console.error("Log request missing sessionId, logName, or content in body");
            return res.status(400).send({ success: false, error: "Missing sessionId, logName, or content in request body" });
        }

        const folder = path.join(colabDataRoot, sessionId);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
            if (!fs.existsSync(path.join(folder, "plots"))) {
                 fs.mkdirSync(path.join(folder, "plots"), { recursive: true });
            }
        }

        const logFile = path.join(folder, logName);
        if (fs.existsSync(logFile)) {
            fs.appendFileSync(logFile, content + "\n");
        } else {
            fs.writeFileSync(logFile, content + "\n");
        }
        console.log(`${logName}: ${content}`);
        res.status(200).send({ success: true });
    } catch (error) {
        console.error(`Error processing log for session ${req.body.sessionId || 'UNKNOWN'}:`, error);
        res.status(500).send({ success: false, error: error.message });
    }
};

exports.plot = async (req, res) => {
    console.log(`Plot saved: ${req.file.originalname}`);
    res.status(200).send({ success: true });
};

exports.model = async (req, res) => {
    const sessionId = req.query.sessionId;
    const relativePathSent = req.body.relativePath || '.';
    const finalPath = path.join(relativePathSent, req.file.originalname);
    console.log(`File saved for session ${sessionId}: ${finalPath} (Original: ${req.file.originalname})`);
    res.status(200).send({ success: true, message: `File ${req.file.originalname} saved to ${finalPath} for session ${sessionId}` });
};

