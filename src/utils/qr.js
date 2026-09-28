import qrcode from 'qrcode-generator';

const utf8 = new TextEncoder();

qrcode.stringToBytes = (text) => Array.from(utf8.encode(text));

export { qrcode };
