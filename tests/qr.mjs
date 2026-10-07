import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import png from 'pngjs';
const invite=(process.env.GAME_URL || 'https://example.com')+'/?room=ABC234';
const image=await QRCode.toBuffer(invite,{width:256,margin:4,errorCorrectionLevel:'M'});
const decoded=png.PNG.sync.read(image);const code=jsQR(new Uint8ClampedArray(decoded.data),decoded.width,decoded.height);
assert.equal(code?.data,invite);console.log('PASS: QR image decodes to the exact room invite URL.');
