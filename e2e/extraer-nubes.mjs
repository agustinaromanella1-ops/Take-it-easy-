/* Extrae la capa de nubes de la referencia a un archivo con transparencia, así
   se apoya sobre cualquier color de cielo sin arrastrar el viejo.
   Una nube es un pixel que va del cielo al blanco: se mide cuánto avanzó por
   esa recta y eso es su opacidad. El perro, los textos y el botón no están
   sobre esa recta, así que quedan afuera solos; el único que hay que tapar a
   mano es el texto blanco DENTRO del botón. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const b64 = fs.readFileSync('/home/user/Take-it-easy-/src/assets/pipi-cucu-welcome-reference.png').toString('base64');
const b = await chromium.launch(); const p = await b.newPage(); await p.goto('about:blank');
const url = await p.evaluate(async (b64) => {
  const img = new Image(); img.src='data:image/png;base64,'+b64; await img.decode();
  const W=img.naturalWidth,H=img.naturalHeight;
  const c=document.createElement('canvas'); c.width=W;c.height=H;
  const g=c.getContext('2d'); g.drawImage(img,0,0);
  const src=g.getImageData(0,0,W,H);
  const d=src.data;
  const CIELO=[149,214,253];
  const out=g.createImageData(W,H);
  const o=out.data;
  // caja del botón, donde vive el único blanco que no es nube
  const BX0=120,BX1=822,BY0=1176,BY1=1316;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4, R=d[i],G=d[i+1],B=d[i+2];
    let a=0;
    if(!(x>=BX0&&x<=BX1&&y>=BY0&&y<=BY1)){
      const t=(R-CIELO[0])/(255-CIELO[0]);
      /* El umbral alto es a propósito: el halo claro que deja el antialias
         alrededor de las letras también cae sobre la recta cielo→blanco, pero
         siempre flojo. Pidiendo que la nube esté bien avanzada hacia el blanco
         se va el fantasma del texto y la nube queda entera. */
      if(t>0.30){
        const gEsp=CIELO[1]+t*(255-CIELO[1]), bEsp=CIELO[2]+t*(255-CIELO[2]);
        if(Math.abs(G-gEsp)<9 && Math.abs(B-bEsp)<9) a=Math.min(1,(t-0.30)/0.70);
      }
    }
    o[i]=255;o[i+1]=255;o[i+2]=255;o[i+3]=Math.round(a*255);
  }
  g.putImageData(out,0,0);
  /* Las nubes son textura suave y se estiran a pantalla completa: a la mitad de
     resolución no se nota y el archivo pesa una fracción. */
  const chico=document.createElement('canvas');
  chico.width=Math.round(W/2); chico.height=Math.round(H/2);
  const gc=chico.getContext('2d');
  gc.imageSmoothingQuality='high';
  gc.drawImage(c,0,0,chico.width,chico.height);
  return chico.toDataURL('image/webp',0.8);
}, b64);
await b.close();
fs.writeFileSync('/home/user/Take-it-easy-/public/pipi-cucu-clouds.webp', Buffer.from(url.split(',')[1],'base64'));
console.log('nubes:', (fs.statSync('/home/user/Take-it-easy-/public/pipi-cucu-clouds.webp').size/1024).toFixed(0), 'KB');
