import ws from 'ws';
import crypto from 'crypto';
import qrcode from 'qrcode';
console.log('Generating key pair...');
const key = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048
});
console.log('Connecting to discord...');
const connection = new ws('wss://remote-auth-gateway.discord.gg/?v=1', {
    headers: {
        Origin: 'https://discord.com',
        Host: 'remote-auth-gateway.discord.gg',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36'
    }
});
connection.on('message', message => {
    const data = JSON.parse(message.toString());
    switch (data.op) {
        case 'hello':
            console.log('Connected!');
            const heartbeat = setInterval(() => {
                connection.send(JSON.stringify({
                    op: 'heartbeat'
                }));
            }, data.heartbeat_interval);
            connection.once('close', code => {
                clearInterval(heartbeat);
                console.log('Connection closed');
                console.log(`Code: ${code}`);
                process.exit(1);
            });
            connection.send(JSON.stringify({
                op: 'init',
                encoded_public_key: key.publicKey.export({
                    format: 'der',
                    type: 'spki'
                }).toString('base64').replace(/=/gi, '')
            }));
            break;
        case 'nonce_proof':
            console.log('Validating...');
            const nonce = crypto.privateDecrypt({
                key: key.privateKey,
                oaepHash: 'sha256'
            }, Buffer.from(data.encrypted_nonce, 'base64'));
            connection.send(JSON.stringify({
                op: 'nonce_proof',
                proof: crypto.createHash('sha256').update(nonce).digest('base64').replace(/\//g, '_').replace(/\+/g, "-").replace(/={1,2}$/, "")
            }));
            break;
        case 'pending_remote_init':
            console.log('QR code url arrived!');
            const qrcodeUrl = `https://discord.com/ra/${data.fingerprint}`;
            console.log(`Run 'npm run client' or 'yarn client' and type this QR code url:`);
            console.log(qrcodeUrl);
            console.log('You may also use this QR code with mobile app:');
            qrcode.toString(qrcodeUrl).then(console.log);
            break;
        case 'pending_finish':
            const userData = crypto.privateDecrypt({
                key: key.privateKey,
                oaepHash: 'sha256'
            }, Buffer.from(data.encrypted_user_payload, 'base64')).toString().split(':');
            console.log('Waiting for the client to accept...');
            console.log(`User: ${userData[3]}`);
            console.log(`Tag: ${userData[1]}`);
            console.log(`user ID: ${userData[0]}`);
            break;
        case 'finish':
            console.log('Login accepted!');
            console.log(`Your Discord token is ${crypto.privateDecrypt({
                key: key.privateKey,
                oaepHash: 'sha256'
            }, Buffer.from(data.encrypted_token, 'base64')).toString()}`);
            process.exit(0);
        case 'cancel':
            console.log('Login cancelled.');
            process.exit(0);
    }
});
