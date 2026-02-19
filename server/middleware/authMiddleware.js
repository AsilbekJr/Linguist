const admin = require('firebase-admin');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // Mock Mode Check
            if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && token === 'mock-token') {
                req.user = {
                    uid: 'mock-user-id',
                    email: 'mock@example.com',
                    name: 'Mock User'
                };
                return next();
            }

            const decodedToken = await admin.auth().verifyIdToken(token);
            req.user = decodedToken;
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };
