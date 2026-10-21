import {readFile} from 'node:fs/promises';
const rights=JSON.parse(await readFile(new URL('../assets/audio/RIGHTS.json',import.meta.url),'utf8'));
if(rights.redistributionConfirmed!==true||!rights.evidence?.trim()){
 throw new Error('Audio redistribution rights are unconfirmed. Local development is available; public staging/deployment is blocked. See assets/audio/RIGHTS.json and docs/AUDIO.md.');
}
console.log('Audio redistribution confirmation recorded.');
