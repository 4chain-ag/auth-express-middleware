async function manualAuthFetch() {
    const output = document.getElementById("output") || console;
    const log = (msg) => {
        console.log(msg);
        if (output !== console) {
            output.innerText += msg + "\n";
        }
    };

    try {
        const { PrivateKey, CompletedProtoWallet, Utils, Random } = await import("https://cdn.jsdelivr.net/npm/@bsv/sdk/+esm");

        log("Starting authentication...");

        const clientPrivateKey = new PrivateKey(2);
        const clientWallet = new CompletedProtoWallet(clientPrivateKey);

        const clientPubkeyObj = await clientWallet.getPublicKey({ identityKey: true });
        const clientIdentityKey = clientPubkeyObj.publicKey;
        log(`Client Identity Key: ${clientIdentityKey}`);

        const initialNonceBytes = Random(32);
        const initialNonce = Utils.toBase64(initialNonceBytes);
        log(`Initial Client Nonce: ${initialNonce}`);

        const initialRequest = {
            version: "0.1",
            messageType: "initialRequest",
            identityKey: clientIdentityKey,
            initialNonce: initialNonce,
        };

        log("Sending initial request...");
        const initialResponse = await fetch("http://localhost:3000/.well-known/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(initialRequest),
        });

        if (!initialResponse.ok) {
            throw new Error(`Initial request failed: ${initialResponse.status}`);
        }

        const responseData = await initialResponse.json();
        const serverIdentityKey = responseData.identityKey;
        const serverNonce = responseData.initialNonce;

        log(`Server Identity Key: ${serverIdentityKey}`);
        log(`Server Nonce: ${serverNonce}`);

        const requestIdBytes = Random(32);
        const requestId = Utils.toBase64(requestIdBytes);
        log(`Request ID: ${requestId}`);

        const newNonceBytes = Random(32);
        const newNonce = Utils.toBase64(newNonceBytes);
        log(`New Client Nonce: ${newNonce}`);

        const method = "GET";
        const path = "/api/ping";
        const url = "http://localhost:3000/api/ping";

        const writer = new Utils.Writer();
        // GO BACK HERE!!!
        // Check if they are not wrong by putting nonce here:
        // Point 6.9: https://bsv.brc.dev/peer-to-peer/0104
        writer.write(requestIdBytes);
        writer.writeVarIntNum(method.length);
        writer.write(Utils.toArray(method, "utf8"));
        writer.writeVarIntNum(path.length);
        writer.write(Utils.toArray(path, "utf8"));
        writer.writeVarIntNum(-1); // No query
        writer.writeVarIntNum(0);  // No headers
        writer.writeVarIntNum(-1); // No body

        const payloadToSign = writer.toArray();
        log(`Payload to sign (${payloadToSign.length} bytes): ${Utils.toHex(payloadToSign).substring(0, 40)}...`);

        const signResult = await clientWallet.createSignature({
            data: payloadToSign,
            // To check???? In AuthFetch it's the same
            protocolID: [2, 'auth message signature'],
            keyID: `${newNonce} ${serverNonce}`,
            counterparty: serverIdentityKey
        });

        const signatureHex = Utils.toHex(signResult.signature);

        log(`Signature (hex): ${signatureHex.substring(0, 40)}...`);

        const headers = {
            "x-bsv-auth-version": "0.1",
            "x-bsv-auth-identity-key": clientIdentityKey,
            "x-bsv-auth-nonce": newNonce,
            "x-bsv-auth-your-nonce": serverNonce,
            "x-bsv-auth-signature": signatureHex,
            "x-bsv-auth-request-id": requestId,
        };

        log("\nSending headers:");
        Object.entries(headers).forEach(([key, value]) => {
            log(`${key}: ${value.substring(0, 40)}${value.length > 40 ? '...' : ''}`);
        });

        log("\nSending authenticated request...");
        const authResponse = await fetch(url, {
            method,
            headers,
        });

        if (!authResponse.ok) {
            try {
                const errorText = await authResponse.text();
                log(`Authentication failed: ${authResponse.status}, Error: ${errorText}`);
            } catch (e) {
                log(`Authentication failed: ${authResponse.status}, Error: ${e}`);
            }
            throw new Error(`Authentication failed: ${authResponse.status}`);
        }

        const authData = await authResponse.json();
        log(`\nAuthenticated Response: ${JSON.stringify(authData, null, 2)}`);

        log("\nAuthentication Headers Received:");
        authResponse.headers.forEach((value, key) => {
            if (key.toLowerCase().startsWith("x-bsv-auth")) {
                log(`${key}: ${value.substring(0, 40)}...`);
            }
        });

        log("\nAuthentication successful!");
    } catch (error) {
        log(`Error: ${error.message}`);
        console.error(error);
    }
}

window.manualAuthFetch = manualAuthFetch;
