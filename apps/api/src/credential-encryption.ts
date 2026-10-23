import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key(): Buffer {
  const value = Buffer.from(process.env.EASYCLOCK_CREDENTIALS_KEY || '', 'base64');
  if (value.length !== 32) throw new Error('Configure EASYCLOCK_CREDENTIALS_KEY com uma chave de 32 bytes em base64.');
  return value;
}
export function encryptSettings(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), value: encrypted.toString('base64') });
}
export function decryptSettings(value: string): string {
  const data = JSON.parse(value);
  if (data.version !== 1) throw new Error('Versão de criptografia desconhecida.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(data.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(data.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data.value, 'base64')), decipher.final()]).toString('utf8');
}
