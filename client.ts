import axios from 'axios';
import readline from 'readline';
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('Please enter your QR code url. It starts with \'https://discord.com/ra/\'.');
rl.question('', url => {
    if (url == undefined || url == '') {
        console.log('No url provided.');
        process.exit(1);
    } else if (!url.startsWith('https://discord.com/ra/')) {
        console.log('Invalid url');
        process.exit(1);
    } else {
        const fingerprint = url.replace('https://discord.com/ra/', '');
        console.log(`Please enter your Discord token. You can get yours by
1. Open Discord
2. Press Ctrl+Shift+I (⌥⌘I on macOS) to open developer tools
3. Press Ctrl+Shift+M (⇧⌘M) to toggle device toolbar
4. Navigate to the Application tab
5. On the left, expand Local Storage and select https꞉//discord.com
6. Type token into the Filter box
7. If the token key does not appear, press Ctrl+R (⌘R) to reload
8. Copy the value of the token key`);
    rl.question('', async token => {
            if (token == undefined || token == '') {
                console.log('No Discord token provided.');
                process.exit(1);
            } else {
                const init = await axios.post(`https://discord.com/api/users/@me/remote-auth`, { fingerprint }, {
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: token
                    },
                    validateStatus: () => true
                });
                if (init.status >= 400) {
                    console.log('Invalid url or Discord token.');
                    process.exit(1);
                } else {
                    const handshake_token = init.data.handshake_token;
                    console.log('If this QR code is not from you, AN ATTACKER MIGHT BE TRYING TO STEAL YOUR ACCOUNT!');
                    rl.question('Do you really want to login? [y/n] ', async isLogin => {
                        if (isLogin && (isLogin == 'y' || isLogin == 'Y')) {
                            console.log('Accepting login...');
                            const finish = await axios.post('https://discord.com/api/users/@me/remote-auth/finish', {
                                handshake_token,
                                temporary_token: false
                            }, {
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: token
                                },
                                validateStatus: () => true
                            });
                            if (finish.status >= 400) {
                                console.log('An error occurred.');
                                process.exit(1);
                            } else {
                                console.log('Successfully Logined!');
                                process.exit(0);
                            }
                        } else {
                            console.log('Cancelling login...');
                            const finish = await axios.post('https://discord.com/api/users/@me/remote-auth/cancel', { handshake_token }, {
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: token
                                },
                                validateStatus: () => true
                            });
                            if (finish.status >= 400) {
                                console.log('An error occurred.');
                                process.exit(1);
                            } else {
                                console.log('Login cancelled.');
                                process.exit(0);
                            }
                        }
                    })
                }
            }
        })
    }
});