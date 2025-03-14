import express, { Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { CompletedProtoWallet, PrivateKey, VerifiableCertificate } from '@bsv/sdk';
import { createAuthMiddleware, AuthRequest } from '@bsv/auth-express-middleware';

const serverPrivateKey = new PrivateKey(1);
const serverWallet = new CompletedProtoWallet(serverPrivateKey);
let serverIdentityKey: string;

const app = express();

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '10mb' }));

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Expose-Headers', '*');
    res.header('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

app.use((req, res, next) => {
    console.log('Request headers:', req.headers);
    next();
});

app.get('/public', function(req, res) {
    res.json({
        message: 'This is a public endpoint',
        timestamp: new Date().toISOString()
    });
});

const authMiddleware = createAuthMiddleware({
    wallet: serverWallet,
    allowUnauthenticated: false,
    onCertificatesReceived: (senderPublicKey: string, certs: VerifiableCertificate[], req: AuthRequest, res: Response<any, Record<string, any>>, next: NextFunction) => {
        console.log(`Got ${certs.length} certs from ${senderPublicKey}`);
        next();
    },
    logger: console,
    logLevel: 'info'
});

app.use(authMiddleware);

app.get('/api/ping', function(req, res) {
    const authReq = req as AuthRequest;
    res.json({
        message: 'pong',
        authenticatedClient: authReq.auth?.identityKey,
        timestamp: new Date().toISOString()
    });
});

app.use(function(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = 3000;
const server = app.listen(PORT, async () => {
    serverIdentityKey = (await serverWallet.getPublicKey({ identityKey: true })).publicKey;

    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Public endpoint: http://localhost:${PORT}/public`);
    console.log(`Protected endpoint: http://localhost:${PORT}/api/ping (requires authentication)`);
    console.log(`Server identity key: ${serverIdentityKey}`);
});

export { app, server, serverWallet };
