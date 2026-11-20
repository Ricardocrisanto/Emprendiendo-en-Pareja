export function adText(product, price) {
 const details=[product.size&&`Talla: ${product.size}`,product.color&&`Color: ${product.color}`].filter(Boolean);
 return [product.name,...details,`Precio: ${price} MXN`,'Mándame mensaje para más información.'].join('\n');
}

export function facebookGroup(value) {
 try {
  const url=new URL(value.trim());
  if(url.protocol!=='https:'||!['www.facebook.com','m.facebook.com','facebook.com'].includes(url.host)||
     url.username||url.password||!/^\/groups\/[a-z\d._-]+\/?$/i.test(url.pathname))return null;
  return 'https://www.facebook.com'+url.pathname.replace(/\/$/,'')+'/';
 }catch{return null;}
}

export function productPhotos(productId, photos) {
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('pareja-product-photos',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('photos');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result;
   try{
    const transaction=db.transaction('photos',photos?'readwrite':'readonly');
    const collection=transaction.objectStore('photos');
    const operation=photos?collection.put(photos,productId):collection.get(productId);
    transaction.oncomplete=()=>{db.close();resolve(photos??operation.result??[]);};
    transaction.onabort=()=>{db.close();reject(transaction.error);};
   }catch(error){db.close();reject(error);}
  };
 });
}

export async function compressPhoto(file) {
 if(file.size>25*1024*1024)throw Error('Elige una foto de hasta 25 MB.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();
  image.src=url;
  await image.decode();
  const canvas=document.createElement('canvas');
  const context=canvas.getContext('2d',{alpha:false});
  for(const limit of [1400,1000,700,480,320]){
   const scale=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   context.fillStyle='#fff';
   context.fillRect(0,0,canvas.width,canvas.height);
   context.drawImage(image,0,0,canvas.width,canvas.height);
   const photo=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.8));
   if(photo&&photo.size<=150000)return photo;
  }
  throw Error('No se pudo guardar esta foto.');
 }finally{URL.revokeObjectURL(url);}
}
