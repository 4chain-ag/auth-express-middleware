import { PrivateKey, CompletedProtoWallet, AuthFetch } from "https://cdn.jsdelivr.net/npm/@bsv/sdk/+esm";

async function testAuthenticatedAPI() {
    const output = document.getElementById("output");

    function log(message) {
        console.log(message);
        output.innerText += message + "\n";
    }

    try {
        log("\nCreating Client Wallet");

        const clientPrivateKey = new PrivateKey(2);
        const clientWallet = new CompletedProtoWallet(clientPrivateKey);

        const clientIdentityKey = (await clientWallet.getPublicKey({ identityKey: true })).publicKey;
        log(`Client Identity Key: ${clientIdentityKey}`);

        log("\nTesting Public Endpoint");
        try {
            const publicResponse = await fetch("http://localhost:3000/public");
            log("Public API Response: " + JSON.stringify(await publicResponse.json(), null, 2));
        } catch (error) {
            log("Error accessing public API: " + error);
        }

        log("\nSetting Up Authenticated Client");
        const authFetch = new AuthFetch(clientWallet);

        log("\nTesting Protected Endpoint");
        log("Making authenticated request to /api/ping...");

        try {
            const authResponse = await authFetch.fetch("http://localhost:3000/api/ping");
            log(`Response Status: ${authResponse.status}`);
            log("Response Body: " + JSON.stringify(await authResponse.json(), null, 2));

            log("\nAuthentication Headers Used");
            authResponse.headers.forEach((value, key) => {
                if (key.toLowerCase().startsWith("x-bsv-auth")) {
                    log(`${key}: ${value.substring(0, 40)}...`);
                }
            });
        } catch (error) {
            log("Authentication Test Failed: " + error);
        }

    } catch (error) {
        log("Error: " + error);
    }
}

window.testAuthenticatedAPI = testAuthenticatedAPI;
