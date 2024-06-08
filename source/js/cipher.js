/// AES-GCM 
async function initAES() {
  const key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return [key, iv]
}

async function initAES(key) {
  return await crypto.subtle.importKey(
    "raw",
    key,
    {name: "AES-GCM", length: 256},
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptAES(message, key, iv) {
  const encoder = new TextEncoder();
  const encodedMessage = encoder.encode(message);
  const ciphertext = await crypto.subtle.encrypt(
      {
          name: "AES-GCM",
          iv: iv
      },
      key,
      encodedMessage
  );
  return ciphertext;
}

async function decryptAES(ciphertext, key, iv) {
  const decrypted = await crypto.subtle.decrypt(
      {
          name: "AES-GCM",
          iv: iv
      },
      key,
      ciphertext
  );
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/// RSA-OAEP-SHA256
async function initRSA() {
  const keyPair = await crypto.subtle.generateKey(
      {
          name: "RSA-OAEP",
          modulusLength: 2048, 
          publicExponent: new Uint8Array([1, 0, 1]), // 65537
          hash: "SHA-256" 
      },
      true, 
      ["encrypt", "decrypt"] 
  );
  return keyPair;
}

async function encryptRSA(message, publicKey, encode=true) {
  const encodedMessage = encode ? new TextEncoder().encode(message) : message;
  const ciphertext = await crypto.subtle.encrypt(
      {
          name: "RSA-OAEP"
      },
      publicKey,
      encodedMessage
  );
  return ciphertext;
}

async function decryptRSA(ciphertext, privateKey) {
    const decrypted = await crypto.subtle.decrypt(
        {
            name: "RSA-OAEP"
        },
        privateKey,
        ciphertext
    );
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

/// HMAC with SHA-256
async function initMAC(key) {
  //const encoded = new TextEncoder().encode(key);
  return await crypto.subtle.importKey(
    "raw",
    key,
    {
      name: "HMAC",
      hash: {name: "SHA-256"}
    },
    false,
    ["sign", "verify"]
  )
}

async function getMAC(data, key) {
  const encoded = new TextEncoder().encode(data);
  return await crypto.subtle.sign("HMAC", key, encoded);
}

async function checkMAC(message, signature, key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const result = await crypto.subtle.verify(
      {
          name: "HMAC",
          hash: { name: "SHA-256" }
      },
      key,
      signature,
      data
  );
  return result;
}

/// PRF function for generating master secret
async function PRF(preMasterSecret, label, seed, length=48) {
  const encoder = new TextEncoder();
  let result = new Uint8Array();
  const key = await initMAC(preMasterSecret);

  let A = [...label, ...seed];
  let newSeed = A;
  while (result.length < length) {
    A = new Uint8Array(await getMAC(A, key));
    const val = new Uint8Array(await getMAC([...A, ...newSeed], key));
    result = new Uint8Array([...result, ...val]);
  }
  return result.slice(0, length);
}

module.exports = {
  initAES, encryptAES, decryptAES,
  initRSA, encryptRSA, decryptRSA,
  initMAC, getMAC, checkMAC,
  PRF
}
