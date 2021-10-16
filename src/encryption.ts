import CryptoJS from 'crypto-js'

export const encrypt = (plainText : string, secret : string) : string => {
  const b64 = CryptoJS.AES.encrypt(plainText, secret).toString()
  const e64 = CryptoJS.enc.Base64.parse(b64)
  const eHex = e64.toString(CryptoJS.enc.Hex)
  return eHex
}

export const decrypt = (cipherText : string, secret : string) : string => {
  const reb64 = CryptoJS.enc.Hex.parse(cipherText)
  const bytes = reb64.toString(CryptoJS.enc.Base64)
  const decrypt = CryptoJS.AES.decrypt(bytes, secret)
  const plain = decrypt.toString(CryptoJS.enc.Utf8)
  return plain
}
