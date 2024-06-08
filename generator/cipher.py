from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_OAEP, AES
from Crypto.Random import get_random_bytes
from Crypto.Hash import SHA256
from Crypto.Util.Padding import pad, unpad
import base64

# RSA algo
def initRSA():
  key = RSA.generate(2048)

  private_key = key.export_key()
  public_key = key.publickey().export_key()
  return [public_key, private_key]

def encryptRSA(message, public_key):
  
  cipher_rsa = PKCS1_OAEP.new(RSA.import_key(public_key), hashAlgo=SHA256.new())
  encrypted_message = cipher_rsa.encrypt(message.encode())
  
  return encrypted_message

def decryptRSA(ciphertext, private_key):
  
  cipher_rsa = PKCS1_OAEP.new(RSA.import_key(private_key), hashAlgo=SHA256.new())
  decrypt_message = cipher_rsa.decrypt(ciphertext)
  
  return decrypt_message.decode()

#AES algo
def initAES():

  key = get_random_bytes(32)
  iv = get_random_bytes(16)
  return [key, iv]

def encryptAES(message, key, iv):
  # message: string
  cipher = AES.new(key, AES.MODE_CBC, iv)

  padding = pad(message.encode(), AES.block_size)

  ciphertext = cipher.encrypt(padding)
  return ciphertext
  #print(base64.b64encode(ciphertext).decode())

def decryptAES(ciphertext, key, iv):
  cipher = AES.new(key, AES.MODE_CBC, iv)
  decrypted = cipher.decrypt(ciphertext)
  message = unpad(decrypted, AES.block_size)
  
  return message.decode()


from browser import console, window
browser.initRSA = initRSA
browser.encryptRSA = encryptRSA
browser.decryptRSA = decryptRSA

browser.initAES = initAES
browser.encryptAES = encryptAES
browser.decryptAES = decryptAES