import {adText,facebookGroup,productPhotos,compressPhoto} from './ads.js';
import {defaultSettings,sum,money,num,rounded,currentMonth,today,derive,purchaseTotals,purchaseLineCosts,simulation} from './core.js';

const STORAGE_KEY='emprendiendo-en-pareja-local-v1';
const CATEGORIES=['Transporte','Empaques','Publicidad','Comisiones','Entregas','Otros'];
const VIEWS=[['inicio','Inicio','home'],['ventas','Ventas','receipt'],['inventario','Inventario','shirt'],['compras','Compras','bag'],['gastos','Gastos','wallet'],['simulador','Simulador','chart'],['ajustes','Ajustes','settings']];
const svgPaths={home:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',receipt:'<path d="M4 3h16v18l-4-2-4 2-4-2-4 2z"/><path d="M8 8h8M8 12h8"/>',shirt:'<path d="m16 3 5 4-3 5-3-2v11H9V10l-3 2-3-5 5-4 4 3z"/>',bag:'<path d="M5 8h14l1 13H4z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',wallet:'<rect x="2" y="5" width="20" height="16" rx="3"/><path d="M2 9h20M16 14h6"/>',chart:'<path d="M3 3v18h18M7 17l4-5 4 3 5-8"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 10v7M12 6h.01"/>',check:'<path d="m5 12 4 4L19 6"/>',alert:'<path d="M12 3 2 21h20zM12 9v5M12 17h.01"/>',logout:'<path d="M10 3H4v18h6M14 7l5 5-5 5M19 12H9"/>'};
const icon=(name,size=19)=>`<svg class="ico" style="width:${size}px;height:${size}px" viewBox="0 0 24 24" aria-hidden="true">${svgPaths[name]||svgPaths.info}</svg>`;
const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const fmtDate=d=>{try{return new Date(`${d}T12:00:00`).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});}catch{return d;}};
const status=(stock)=>stock<=0?'<span class="tag bad">Agotado</span>':stock<=2?'<span class="tag warn">Pocas piezas</span>':'<span class="tag ok">Disponible</span>';
let current='inicio', store, toastTimer;
const sim={vestQty:5,jacketQty:5,vestPrice:320,jacketPrice:390,capital:4000,reserve:1000,min:10,discount:50,costPerSale:15,fixedCost:100};
function saveLocal(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}
 catch{
  loadLocal();
  render();
  throw Error('No se pudo guardar. Revisa el espacio y los permisos de almacenamiento del navegador.');
 }
}
function loadLocal(){
 const blank={products:[],purchases:[],sales:[],expenses:[],profiles:[],activeProfileId:null,settings:{...defaultSettings}};
 const saved=localStorage.getItem(STORAGE_KEY);
 store=saved?{...blank,...JSON.parse(saved)}:blank;
 Object.assign(sim,{capital:store.settings.capital,reserve:store.settings.reserve,min:store.settings.minimum,discount:store.settings.discount});
}
function activeProfile(){
 return store.profiles.find(profile=>profile.id===store.activeProfileId);
}
function addProfile(form){
 const name=String(form.get('name')??'').trim();
 if(!name||name.length>40)throw Error('Escribe un nombre de hasta 40 caracteres.');
 if(store.profiles.some(profile=>profile.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('Ya existe un perfil con ese nombre.');
 const profile={id:id(),name};
 store.profiles.push(profile);
 store.activeProfileId=profile.id;
 saveLocal();
 render();
}
function profilePanel(){
 const options=store.profiles.map(profile=>`<option value="${profile.id}" ${profile.id===store.activeProfileId?'selected':''}>${escapeHtml(profile.name)}</option>`).join('');
 return `<div class="soft" style="margin-top:19px"><h4>Perfiles de este dispositivo</h4><p>Los perfiles identifican quién registra cada movimiento y usan el mismo inventario en este navegador.</p>
  <div class="field"><label for="active-profile">Perfil activo</label><select id="active-profile"><option value="">Sin perfil</option>${options}</select></div>
 </div>
 <form id="profile-form" class="form-grid" style="margin-top:12px">
  <div class="field full"><label for="profile-name">Nombre del nuevo perfil</label><input id="profile-name" name="name" maxlength="40" required></div>
  <div class="field full"><button type="submit" class="secondary">Agregar perfil</button></div>
 </form>`;
}
function toast(msg){const el=document.querySelector('#toast');el.textContent=msg;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3100);}
function errorMessage(err){return err.message||'No se pudo completar la operación.';}
function productsOptions(){return store.products.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} · ${escapeHtml(p.color)} ${escapeHtml(p.size)} (${p.stock} disp.)</option>`).join('');}
function viewName(){return VIEWS.find(v=>v[0]===current)?.[1]||'Inicio';}
function stateReady(){return !!store && !!store.products && !!store.settings;}
function shell(content){
 const nav=v=>`<button data-action="navigate" data-view="${v[0]}" class="nav-btn ${current===v[0]?'active':''}">${icon(v[2])}<span>${v[1]}</span></button>`;
 const mobile=VIEWS.map(v=>`<button data-action="navigate" data-view="${v[0]}" class="${current===v[0]?'active':''}">${icon(v[2])}<span>${v[1]}</span></button>`).join('');
 return `<div class="layout">
  <aside class="sidebar"><div class="brand"><span class="brand-icon">✦</span><div><strong>${escapeHtml(store.settings.businessName||'Emprendiendo en Pareja')}</strong><small>GESTIÓN DE TIENDA</small></div></div>
  <div><p class="nav-label">MI NEGOCIO</p><nav class="nav">${VIEWS.map(nav).join('')}</nav></div>
  <div class="sidebar-end"><strong>Tu tienda, bajo control ✨</strong><p>Comienza con lo esencial y toma decisiones con tus números.</p></div></aside>
  <main class="main"><div class="top-mobile-brand"><span class="brand-icon">✦</span>${escapeHtml(store.settings.businessName)}</div><div class="topbar"><div class="breadcrumb">Mi negocio <span style="margin:0 8px;color:#B1A6A8">/</span> ${viewName()}</div><div class="topright"><span class="pill demo"><span class="dot"></span>Guardado en este dispositivo</span><span class="avatar" title="${escapeHtml(activeProfile()?.name||'Sin perfil')}">${escapeHtml(activeProfile()?.name.slice(0,1).toUpperCase()||'✦')}</span></div></div>
  ${content}<p class="footnote">Los registros permanecen en este navegador.</p></main></div><nav class="mobile-nav">${mobile}</nav>`;
}
function head(title,desc,button=''){return `<div class="headrow"><div><div class="eyebrow">Mi boutique • Control sencillo</div><h1 class="page-title">${title}</h1><p class="subtitle">${desc}</p></div>${button}</div>`;}
function stat(label,value,foot,ico='chart',tone=''){return `<article class="stat"><div class="stat-head"><span class="stat-label">${label}</span><span class="stat-ico ${tone}">${icon(ico,17)}</span></div><div class="stat-value ${tone==='green'?'positive':''}">${value}</div><div class="stat-foot">${foot}</div></article>`;}
function salesChart(){
 const last=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;});
 const series=last.map(month=>({month,revenues:sum(store.sales.filter(s=>s.status!=='cancelada'&&s.date.startsWith(month)).map(s=>s.qty*s.price-s.discount+s.shippingCollected)),expenses:sum(store.expenses.filter(e=>e.date.startsWith(month)).map(e=>e.amount))}));
 const max=Math.max(1,...series.map(s=>Math.max(s.revenues,s.expenses)));
 return `<div class="bar-chart">${series.map(s=>`<div class="bar-group"><div class="bar-cols"><div class="mini-bar ink" title="Gastos ${money(s.expenses)}" style="height:${Math.max(2,s.expenses/max*145)}px"></div><div class="mini-bar rose" title="Ventas ${money(s.revenues)}" style="height:${Math.max(2,s.revenues/max*145)}px"></div></div><label>${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][Number(s.month.slice(5))-1]}</label></div>`).join('')}</div><div class="legend"><span><i style="background:#C4B1B6"></i> Gastos</span><span><i style="background:var(--pink)"></i> Ventas</span></div>`;
}
function viewDashboard(){const m=derive(store);const totalProducts=store.products.length;const reserve=Math.max(0,num(store.settings.reserve));const filled=m.itemsSold+m.stock;const percent=filled?Math.round(m.itemsSold/filled*100):0;
 return `${head('Tu negocio, de un vistazo','Revisa tu dinero, tus ventas y las prendas que tienes disponibles.',`<button data-action="new-sale" class="primary">${icon('plus',16)} Registrar venta</button>`)}
 <div class="hero"><div><p>Tu espacio de negocio</p><h2>Pequeños pasos, grandes ventas ✨</h2><div class="note">Todo lo que necesitas saber de tu emprendimiento, en una sola pantalla. Menos capturas, más claridad.</div></div><button data-action="navigate" data-view="simulador" class="primary">Probar precios ${icon('arrow',16)}</button></div>
 <section class="stats">${stat('Dinero en efectivo',money(m.cash),'Saldo estimado', 'wallet')}${stat('Utilidad acumulada',money(m.profit),'Ventas menos costos y gastos','chart','green')}${stat('Mercancía disponible',String(m.stock)+' pzas',money(m.inventory)+' invertidos','shirt','sand')}${stat('Ventas acumuladas',money(m.revenue),m.itemsSold+' prendas vendidas','receipt')}</section>
 <section class="cols"><article class="panel"><div class="panel-head"><div><h3 class="panel-title">Tus movimientos</h3><p class="panel-sub">Ventas e importes de gastos de los últimos seis meses</p></div></div>${salesChart()}</article>
 <article class="panel"><div class="panel-head"><div><h3 class="panel-title">Salud del negocio</h3><p class="panel-sub">Datos importantes para decidir qué sigue</p></div></div>
 <div class="progress-block"><div class="progress-head"><span>Prendas vendidas</span><b>${percent}%</b></div><div class="track"><div class="bar" style="width:${percent}%"></div></div></div>
 <div class="progress-block"><div class="progress-head"><span>Dinero libre, después de reserva</span><b>${money(m.available)}</b></div><div class="track"><div class="bar green" style="width:${m.cash>0?Math.max(0,Math.min(100,m.available/m.cash*100)):0}%"></div></div></div>
 <div class="progress-block"><div class="progress-head"><span>Por cobrar</span><b>${money(m.pendingCollections)}</b></div><div class="track"><div class="bar sand" style="width:${m.revenue>0?Math.min(100,m.pendingCollections/m.revenue*100):0}%"></div></div></div>
 <p class="hint">Reserva que elegiste: <strong>${money(reserve)}</strong>. La utilidad y el efectivo no son lo mismo.</p></article></section>
 <section class="panel" style="margin-top:17px"><div class="panel-head"><div><h3 class="panel-title">Acciones rápidas</h3><p class="panel-sub">Registra solo lo necesario</p></div></div><div class="two-actions"><button class="action-card" data-action="new-purchase"><span class="circle">${icon('bag')}</span> Nueva compra</button><button class="action-card" data-action="new-expense"><span class="circle">${icon('wallet')}</span> Registrar gasto</button></div></section>`;
}
function viewInventory(){return `${head('Mis prendas','Cada talla y color tiene su propia existencia.',`<button class="primary" data-action="new-product">${icon('plus',16)} Nueva prenda</button>`)}<div class="panel"><div class="toolbar"><span class="hint">${store.products.length} variantes registradas</span><input type="search" id="search" placeholder="Buscar modelo, talla o SKU…" aria-label="Buscar productos"></div><div class="table-wrap"><table class="table"><thead><tr><th>Prenda</th><th>SKU</th><th>Talla y color</th><th class="num">Existencia</th><th class="num">Costo promedio</th><th class="num">Precio venta</th><th>Estado</th></tr></thead><tbody>${store.products.map(p=>`<tr data-search="${escapeHtml([p.name,p.sku,p.color,p.size].join(' ').toLowerCase())}"><td><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.category||'Ropa')}</small><button class="secondary small" data-action="prepare-ad" data-id="${escapeHtml(p.id)}">Preparar anuncio</button></td><td>${escapeHtml(p.sku)}</td><td>${escapeHtml(p.size)} / ${escapeHtml(p.color)}</td><td class="num"><strong>${p.stock}</strong></td><td class="num">${money(p.stock>0?p.avgCost:p.listCost)}</td><td class="num">${money(p.price)} <button class="ghost small" data-action="edit-price" data-id="${escapeHtml(p.id)}" title="Cambiar precio de venta">Editar</button></td><td>${status(p.stock)}</td></tr>`).join('')}</tbody></table></div>${store.products.length?'':'<p class="empty">Aún no tienes prendas. Agrega una para registrar tu primera compra.</p>'}<p class="footnote">Las existencias aumentan con compras y disminuyen con ventas. No se editan manualmente.</p></div>`;}
function viewSales(){let arr=[...store.sales].sort((a,b)=>b.date.localeCompare(a.date));return `${head('Registro de ventas','Guarda una venta y el inventario se descuenta automáticamente.',`<button class="primary" data-action="new-sale">${icon('plus',16)} Nueva venta</button>`)}<div class="panel"><div class="panel-head"><h3 class="panel-title">Historial de ventas</h3><button class="secondary small" data-action="export" data-kind="sales">${icon('download',14)} Exportar CSV</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Producto</th><th>Cliente / Canal</th><th class="num">Piezas</th><th class="num">Total</th><th class="num">Cobrado</th><th>Estado</th></tr></thead><tbody>${arr.map(s=>`<tr><td>${fmtDate(s.date)}${s.recordedBy?`<small>${escapeHtml(s.recordedBy)}</small>`:''}</td><td><strong>${escapeHtml(s.productName)}</strong><small>${escapeHtml(s.size)} / ${escapeHtml(s.color)}</small></td><td>${escapeHtml(s.customer||'Mostrador')}<small>${escapeHtml(s.channel||'Local')}</small></td><td class="num">${s.qty}</td><td class="num">${money(s.qty*s.price-s.discount+s.shippingCollected)}</td><td class="num">${money(s.paidAmount)}</td><td>${s.status==='cancelada'?'<span class="tag bad">Cancelada</span>':s.paidAmount>=s.qty*s.price-s.discount+s.shippingCollected?'<span class="tag ok">Pagada</span>':'<span class="tag warn">Saldo pendiente</span>'}</td></tr>`).join('')}</tbody></table></div>${!arr.length?'<p class="empty">Aquí aparecerá tu primera venta. Puedes registrarla desde el botón superior.</p>':''}<p class="footnote">Versión inicial: registra ventas entregadas de un producto por operación. Los apartados, cobros posteriores y devoluciones se incorporarán después.</p></div>`;}
function viewPurchases(){const arr=[...store.purchases].sort((a,b)=>b.date.localeCompare(a.date));return `${head('Mis compras','Cuando llega mercancía, registra el pedido para sumar las existencias.',`<button class="primary" data-action="new-purchase">${icon('plus',16)} Nueva compra</button>`)}<div class="panel"><div class="panel-head"><h3 class="panel-title">Compras realizadas</h3><button class="secondary small" data-action="export" data-kind="purchases">${icon('download',14)} Exportar CSV</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Pedido</th><th>Prenda</th><th class="num">Piezas</th><th class="num">Costo unitario real</th><th class="num">Total</th></tr></thead><tbody>${arr.map(p=>`<tr><td>${fmtDate(p.date)}${p.recordedBy?`<small>${escapeHtml(p.recordedBy)}</small>`:''}</td><td>${escapeHtml(p.orderId)}${p.purchaseType?`<small>${purchaseTypes[p.purchaseType]??''}</small>`:''}</td><td>${escapeHtml(p.productName)}</td><td class="num">${p.qty}</td><td class="num">${money(p.unitCost)}</td><td class="num">${money(p.total)}</td></tr>`).join('')}</tbody></table></div>${!arr.length?'<p class="empty">Todavía no tienes compras registradas.</p>':''}<p class="footnote">Puedes combinar modelos y tallas en un pedido. La mercancía se registra cuando ya la recibiste.</p></div>`;}
function viewExpenses(){const arr=[...store.expenses].sort((a,b)=>b.date.localeCompare(a.date));return `${head('Gastos del negocio','Registra bolsas, entregas, transporte y otros pagos.',`<button class="primary" data-action="new-expense">${icon('plus',16)} Registrar gasto</button>`)}<div class="panel"><div class="panel-head"><h3 class="panel-title">Gastos registrados</h3><button class="secondary small" data-action="export" data-kind="expenses">${icon('download',14)} Exportar CSV</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="num">Monto</th></tr></thead><tbody>${arr.map(e=>`<tr><td>${fmtDate(e.date)}${e.recordedBy?`<small>${escapeHtml(e.recordedBy)}</small>`:''}</td><td><span class="tag">${escapeHtml(e.category)}</span></td><td>${escapeHtml(e.note||'—')}</td><td class="num"><strong>${money(e.amount)}</strong></td></tr>`).join('')}</tbody></table></div>${!arr.length?'<p class="empty">Todavía no has registrado gastos.</p>':''}<p class="footnote">El costo de compra de las prendas se registra en Compras, no aquí. Los importes de entrega y empaque que registraste en una venta también se descuentan allí: no los captures de nuevo como gasto.</p></div>`;}
function simInputs(){return [
 ['capital','Capital inicial',2000,10000,500],['reserve','Reserva de efectivo',0,4000,100],['vestQty','Cantidad de chalecos',0,30,1],['jacketQty','Cantidad de chamarras',0,30,1],['vestPrice','Venta: chaleco',250,550,10],['jacketPrice','Venta: chamarra',280,650,10],['discount','Descuento por pieza',0,100,5],['min','Mínimo de mayoreo',1,30,1],['costPerSale','Gasto por pieza vendida',0,80,5],['fixedCost','Gastos fijos estimados',0,1000,50]
 ].map(([key,label,min,max,step])=>`<div class="field"><div class="form-row"><label for="sim-${key}">${label}</label><strong id="simval-${key}" style="font-size:12px">${['vestQty','jacketQty','min'].includes(key)?sim[key]:money(sim[key])}</strong></div><input class="simulation-slider" type="range" id="sim-${key}" data-sim="${key}" min="${min}" max="${max}" step="${step}" value="${sim[key]}"></div>`).join('');}
function simOutput(){const r=simulation(sim);return `<div class="sim-kpis"><div class="sim-kpi"><small>Inversión en ropa</small><b>${money(r.investment)}</b></div><div class="sim-kpi"><small>Descuento aplicado</small><b>${money(r.discount)} <span style="font-size:10px">/pieza</span></b></div><div class="sim-kpi"><small>Efectivo tras compra</small><b>${money(r.capitalAfterPurchase)}</b></div></div>
 <p class="price-hint">${r.count>=sim.min?`✓ El pedido de ${r.count} prendas alcanza el mínimo de ${sim.min}.`:`Faltan ${sim.min-r.count} prendas para aplicar el descuento supuesto.`}</p>
 ${r.canBuy?'<p class="tag ok">Compra dentro de tu presupuesto y reserva</p>':'<p class="tag bad">La compra compromete tu reserva o supera el capital</p>'}
 <div class="table-wrap" style="margin-top:18px"><table class="result-table"><thead><tr><th>Escenario</th><th>Vendidas</th><th>Ingresos</th><th>Utilidad</th></tr></thead><tbody>${r.scenarios.map(s=>`<tr><td><strong>${s.name}</strong></td><td>${s.sumSold}</td><td>${money(s.revenue)}</td><td style="color:${s.profit>=0?'var(--sage)':'var(--red)'};font-weight:800">${money(s.profit)}</td></tr>`).join('')}</tbody></table></div>
 <p class="footnote">Estos resultados son proyecciones, no ventas reales. Precio normal supuesto: chaleco $270 y chamarra $319. Las utilidades incluyen el gasto por pieza y los gastos fijos indicados, antes de impuestos.</p>`;}
function viewSimulator(){return `${head('Simula tus ganancias','Mueve los controles y descubre cuánto invertir y cuánto podrías ganar.')}<div class="cols"><article class="panel"><div class="panel-head"><div><h3 class="panel-title">Ajusta tu primera compra</h3><p class="panel-sub">Los datos de aquí nunca alteran tus ventas reales</p></div></div><div class="form-grid">${simInputs()}</div></article><article class="panel"><div class="panel-head"><div><h3 class="panel-title">Resultado en tiempo real</h3><p class="panel-sub">Tres escenarios para los próximos 30 días</p></div></div><div id="sim-result">${simOutput()}</div></article></div>`;}
function viewSettings(){return `${head('Configuración','Personaliza lo necesario y mantén la información clara.')}<div class="cols"><section class="panel"><h3 class="panel-title">Datos de mi negocio</h3><p class="panel-sub">Capital, reserva y valores iniciales del simulador</p><form id="settings-form" class="form-grid" style="margin-top:18px"><div class="field full"><label>Nombre del negocio</label><input name="businessName" required maxlength="50" value="${escapeHtml(store.settings.businessName)}"></div><div class="field"><label>Capital inicial ($)</label><input type="number" name="capital" min="0" step="0.01" required value="${store.settings.capital}"></div><div class="field"><label>Reserva ($)</label><input type="number" name="reserve" min="0" step="0.01" required value="${store.settings.reserve}"></div><div class="field"><label>Mínimo de piezas (simulador)</label><input type="number" name="minimum" min="1" step="1" required value="${store.settings.minimum}"></div><div class="field"><label>Descuento por pieza (simulador) ($)</label><input type="number" name="discount" min="0" step="0.01" required value="${store.settings.discount}"></div><div class="field full"><button class="primary" type="submit">Guardar configuración</button></div></form><p class="footnote">El mínimo y el descuento de esta sección solo se usan para simular escenarios.</p></section><section class="panel"><h3 class="panel-title">Perfiles y respaldo</h3>${profilePanel()}<p class="footnote">Exporta un respaldo para conservar una copia de los registros de este navegador.</p><div class="row-gap"><button type="button" class="secondary" data-action="export-all">${icon('download',16)} Exportar respaldo</button></div><div style="margin-top:25px"><h3 class="panel-title">Identidad visual</h3><p class="panel-sub">Paleta boutique</p><div class="row-gap" style="margin-top:12px">${['#9B5268','#F8F5F1','#27242B','#B79E8C','#638477'].map(c=>`<span title="${c}" style="display:inline-block;width:33px;height:33px;border-radius:9px;background:${c};border:1px solid #EAE3DF"></span>`).join('')}</div></div></section></div>`;}
function render(){if(!stateReady())return;const views={inicio:viewDashboard,ventas:viewSales,inventario:viewInventory,compras:viewPurchases,gastos:viewExpenses,simulador:viewSimulator,ajustes:viewSettings};document.querySelector('#app').innerHTML=shell((views[current]||viewDashboard)());}
function showDialog(title,body){let d=document.getElementById('modal');if(!d){d=document.createElement('dialog');d.id='modal';d.className='modal';document.body.append(d);}d.innerHTML=`<div class="modal-head"><h2>${title}</h2><button class="xclose" data-action="close" type="button" aria-label="Cerrar">×</button></div><div class="modal-body">${body}</div>`;d.showModal();}
const field=(name,label,type='text',extra='')=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" ${extra}></div>`;
function dialogProduct(){showDialog('Nueva prenda',`<form id="product-form" class="form-grid">${field('name','Nombre del modelo','text','required maxlength="90" placeholder="Ej. Chaleco Humana"')}${field('sku','Código / SKU','text','required maxlength="40" placeholder="Ej. HUM-ROS-M"')}${field('size','Talla','text','required maxlength="20" placeholder="M"')}${field('color','Color','text','required maxlength="30" placeholder="Rosa"')}${field('category','Categoría','text','value="Ropa" maxlength="40"')}${field('price','Precio de venta ($)','number','min="0" step="0.01" required value="320"')}${field('listCost','Precio normal de compra ($)','number','min="0" step="0.01" value="270"')}
 <div class="field full"><p class="hint">La existencia inicia en cero. Después registra una compra para añadir piezas.</p></div><div class="field full"><div class="modal-actions"><button type="button" class="secondary" data-action="close">Cancelar</button><button type="submit" class="primary">Guardar prenda</button></div></div></form>`);}
function dialogEditPrice(productId){const p=store.products.find(p=>p.id===productId);if(!p)return;showDialog('Editar precio de venta',`<form id="edit-price-form" class="form-grid"><p class="hint field full">${escapeHtml(p.name)} · ${escapeHtml(p.color)} ${escapeHtml(p.size)}</p><input type="hidden" name="productId" value="${escapeHtml(p.id)}">${field('price','Nuevo precio de venta ($)','number',`min="0" step="0.01" value="${p.price}" required`)}<div class="field full"><div class="modal-actions"><button type="button" class="secondary" data-action="close">Cancelar</button><button type="submit" class="primary">Guardar nuevo precio</button></div></div></form>`);}
function dialogSale(){if(!store.products.some(p=>p.stock>0)){toast('Primero registra una compra para añadir prendas al inventario.');return;}
 const options=store.products.filter(p=>p.stock>0).map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} · ${escapeHtml(p.color)} ${escapeHtml(p.size)} (${p.stock} pzas)</option>`).join('');
 showDialog('Registrar venta',`<form id="sale-form" class="form-grid"><div class="field full"><label>Prenda</label><select name="productId" id="sale-product">${options}</select></div>${field('date','Fecha de venta','date',`value="${today()}" required`)}${field('qty','Cantidad','number','min="1" step="1" value="1" required')}${field('price','Precio unitario de venta ($)','number','min="0" step="0.01" required')}${field('discount','Descuento total al cliente ($)','number','min="0" step="0.01" value="0" required')}${field('paidAmount','Cantidad cobrada ($)','number','min="0" step="0.01" required')}${field('customer','Cliente (opcional)','text','maxlength="70" placeholder="Nombre o referencia"')}<div class="field"><label>Canal</label><select name="channel"><option>Facebook</option><option>WhatsApp</option><option>Venta local</option><option>Otro</option></select></div>${field('shippingCollected','Envío cobrado al cliente ($)','number','min="0" step="0.01" value="0" required')}${field('deliveryCost','Costo de entrega ($)','number','min="0" step="0.01" value="0" required')}${field('packagingCost','Costo de empaque ($)','number','min="0" step="0.01" value="0" required')}<div class="field full"><p class="hint">Registra una venta ya confirmada y entregada. Puedes anotar un cobro parcial, pero el seguimiento de abonos adicionales quedará para una versión posterior.</p><div class="modal-actions"><button type="button" class="secondary" data-action="close">Cancelar</button><button class="primary" type="submit">Guardar venta</button></div></div></form>`);
 const s=document.querySelector('#sale-product');s.dispatchEvent(new Event('change',{bubbles:true}));
}
function purchaseLine(index,line={}){
 const newProduct=!line.productId;
 const name='line-name-'+index, size='line-size-'+index, color='line-color-'+index, price='line-sale-price-'+index;
 return `<div class="line-item">
  <div class="form-grid">
   <div class="field"><label for="line-product-${index}">Prenda</label><select id="line-product-${index}" class="line-product"><option value="">+ Nueva prenda</option>${store.products.map(p=>`<option value="${escapeHtml(p.id)}" ${line.productId===p.id?'selected':''}>${escapeHtml(p.name)} · ${escapeHtml(p.color)} ${escapeHtml(p.size)} (${escapeHtml(p.sku)})</option>`).join('')}</select></div>
   <div class="field"><label for="line-qty-${index}">Piezas</label><input id="line-qty-${index}" class="line-qty" type="number" min="1" step="1" value="${escapeHtml(line.qty??1)}" required></div>
   <div class="field"><label for="line-cost-${index}">Precio original por pieza ($)</label><input id="line-cost-${index}" class="line-price" type="number" min="0" step="0.01" value="${escapeHtml(line.unitPrice??'')}" required></div>
  </div>
  <div class="line-details" ${newProduct?'':'hidden'}>
   <div class="form-grid">
    <div class="field"><label for="${name}">Modelo</label><input id="${name}" class="line-name" maxlength="90" value="${escapeHtml(line.name)}" required ${newProduct?'':'disabled'}></div>
    <div class="field"><label for="${size}">Talla</label><input id="${size}" class="line-size" maxlength="20" value="${escapeHtml(line.size)}" required ${newProduct?'':'disabled'}></div>
    <div class="field"><label for="${color}">Color</label><input id="${color}" class="line-color" maxlength="30" value="${escapeHtml(line.color)}" required ${newProduct?'':'disabled'}></div>
    <div class="field"><label for="${price}">Precio de venta ($)</label><input id="${price}" class="line-sale-price" type="number" min="0" step="0.01" value="${escapeHtml(line.price)}" required ${newProduct?'':'disabled'}></div>
   </div>
  </div>
  ${index>0?`<button type="button" class="remove-line" data-action="remove-line" data-index="${index}">Quitar esta línea</button>`:''}
 </div>`;
}
function getPurchaseLines(){
 return [...document.querySelectorAll('#purchase-lines .line-item')].map(row=>({
  productId:row.querySelector('.line-product').value,
  qty:row.querySelector('.line-qty').value,
  unitPrice:row.querySelector('.line-price').value,
  name:row.querySelector('.line-name').value,
  size:row.querySelector('.line-size').value,
  color:row.querySelector('.line-color').value,
  price:row.querySelector('.line-sale-price').value
 }));
}
const purchaseTypes={menudeo:'Menudeo',mayoreo:'Mayoreo'};
function updateOrderSummary(){
 const form=document.querySelector('#purchase-form');
 if(!form)return;
 const lines=getPurchaseLines();
 const discountField=form.elements.discountPerPiece;
 const applies=form.elements.applyDiscount.checked;
 discountField.disabled=!applies;
 discountField.required=applies;
 discountField.closest('.field').style.display=applies?'':'none';
 const discount=applies?num(discountField.value):0;
 const totals=purchaseTotals(lines,discount,num(form.elements.shipping.value));
 const summary=form.querySelector('#order-summary');
 if(applies&&lines.some(line=>line.unitPrice!==''&&discount>num(line.unitPrice))){
  summary.textContent='El descuento por pieza supera el precio original de una prenda.';
  return;
 }
 summary.innerHTML=`<div class="sumline"><span>Total por ${totals.qty} piezas</span><span>${money(totals.total)}</span></div>
 <p class="hint">Subtotal: ${money(totals.subtotal)} · Descuento: ${money(totals.savings)} · Envío: ${money(totals.shipping)}</p>`;
}
function dialogPurchase(){
 showDialog('Nueva compra',`<form id="purchase-form">
 <div class="form-grid" style="margin-bottom:17px">
  ${field('date','Fecha de recepción','date',`value="${today()}" required`)}
  ${field('orderId','Folio de pedido','text',`value="PED-${String(Date.now()).slice(-6)}" required maxlength="60"`)}
  <div class="field"><label for="purchase-type">Tipo de compra</label><select id="purchase-type" name="purchaseType">${Object.entries(purchaseTypes).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></div>
  <label style="align-self:center"><input type="checkbox" name="applyDiscount"> Aplicar descuento</label>
  ${field('discountPerPiece','Descuento por pieza ($)','number','min="0.01" step="0.01" disabled')}
 </div>
 <div id="purchase-lines">${purchaseLine(0)}</div>
 <button class="secondary small" type="button" data-action="add-line">${icon('plus',14)} Otra prenda</button>
 <div style="margin-top:15px">${field('shipping','Envío total del proveedor ($)','number','min="0" step="0.01" value="0"')}</div>
 <div id="order-summary" style="margin-top:14px" aria-live="polite"></div>
 <p class="footnote">Captura la cantidad real de cada prenda. El descuento indicado se resta por pieza y el envío se reparte entre todas las piezas para calcular su costo en inventario.</p>
 <div class="modal-actions"><button class="secondary" type="button" data-action="close">Cancelar</button><button class="primary" type="submit">Registrar compra recibida</button></div>
 </form>`);
 updateOrderSummary();
}
function dialogExpense(){showDialog('Registrar gasto',`<form id="expense-form" class="form-grid">${field('date','Fecha','date',`value="${today()}" required`)}<div class="field"><label>Categoría</label><select name="category">${CATEGORIES.map(v=>`<option>${v}</option>`).join('')}</select></div>${field('amount','Importe ($)','number','min="0.01" step="0.01" required')}<div class="field full">${field('note','Detalle (opcional)','text','maxlength="120" placeholder="Ej. bolsas para prendas"')}</div><div class="field full"><div class="modal-actions"><button type="button" class="secondary" data-action="close">Cancelar</button><button type="submit" class="primary">Guardar gasto</button></div></div></form>`);}
async function addProduct(form){const p={sku:String(form.get('sku')).trim().toUpperCase(),name:String(form.get('name')).trim(),size:String(form.get('size')).trim(),color:String(form.get('color')).trim(),category:String(form.get('category')||'Ropa').trim(),price:rounded(form.get('price')),listCost:rounded(form.get('listCost')),stock:0,avgCost:0};if(store.products.some(x=>x.sku.toLowerCase()===p.sku.toLowerCase()))throw Error('Ya existe ese SKU. Usa uno diferente.');store.products.push({id:id(),...p});saveLocal();render();}
async function savePrice(form){const p=store.products.find(p=>p.id===form.get('productId'));if(!p)throw Error('Producto inexistente.');const price=rounded(form.get('price'));if(price<0)throw Error('El precio no puede ser negativo.');p.price=price;saveLocal();render();}
async function addExpense(form){const e={date:form.get('date'),category:form.get('category'),amount:rounded(form.get('amount')),note:String(form.get('note')||'').trim()};if(e.amount<=0)throw Error('El gasto debe ser mayor que cero.');store.expenses.push({id:id(),...e,recordedBy:activeProfile()?.name??null});saveLocal();render();}
async function savePurchase(form){
 const date=form.get('date'), orderId=String(form.get('orderId')).trim(), shipping=rounded(form.get('shipping'));
 if(!date||!orderId)throw Error('Completa fecha y folio.');
 const lines=getPurchaseLines().map(line=>({...line,qty:Number(line.qty),unitPrice:line.unitPrice===''?NaN:Number(line.unitPrice)}));
 if(!lines.length||lines.some(l=>!Number.isSafeInteger(l.qty)||l.qty<1||!Number.isFinite(l.unitPrice)||l.unitPrice<0))throw Error('Revisa las cantidades y costos de compra.');
 const purchaseType=form.get('purchaseType');
 if(!Object.prototype.hasOwnProperty.call(purchaseTypes,purchaseType))throw Error('Selecciona menudeo o mayoreo.');
 const applies=form.has('applyDiscount');
 const discountPerPiece=applies?rounded(form.get('discountPerPiece')):0;
 if(applies&&(!Number.isFinite(discountPerPiece)||discountPerPiece<=0))throw Error('Captura el descuento por pieza.');
 if(lines.some(l=>l.unitPrice<discountPerPiece))throw Error('El descuento por pieza no puede superar el precio original de una prenda.');
 const totals=purchaseTotals(lines,discountPerPiece,shipping);
 const costs=purchaseLineCosts(lines,totals);
 const newProducts=[];
 const selectedIds=new Set();
 const variantKey=p=>JSON.stringify([p.name,p.size,p.color].map(value=>String(value??'').trim().toLowerCase()));
 const variantKeys=new Set(store.products.map(variantKey));
 const recordedBy=activeProfile()?.name??null;
 const entries=lines.map((line,index)=>{
  let product=store.products.find(p=>p.id===line.productId);
  if(line.productId){
   if(!product)throw Error('Producto no encontrado.');
   if(selectedIds.has(product.id))throw Error('Agrupa las cantidades de la misma prenda en una sola línea.');
   selectedIds.add(product.id);
  }else{
   const name=line.name.trim(), size=line.size.trim(), color=line.color.trim(), price=Number(line.price);
   if(!name||!size||!color||line.price===''||!Number.isFinite(price)||price<0)throw Error('Completa el modelo, la talla, el color y el precio de venta de cada prenda nueva.');
   const productId=id();
   product={id:productId,sku:`PRE-${productId.toUpperCase()}`,name,size,color,category:'Ropa',price:rounded(price),listCost:rounded(line.unitPrice),stock:0,avgCost:0};
   const key=variantKey(product);
   if(variantKeys.has(key))throw Error(`Ya hay una línea o una prenda con el modelo, talla y color de "${name}". Selecciona la prenda existente o agrupa las piezas.`);
   variantKeys.add(key);
   newProducts.push(product);
  }
  const item={id:id(),productId:product.id,productName:product.name,qty:line.qty,date,orderId,purchaseType,originalUnitPrice:line.unitPrice,discountPerPiece,...costs[index],recordedBy};
  return {product,item};
 });
 const funds=derive(store);
 if(totals.total>funds.cash)throw Error('El pedido supera el efectivo disponible. Esta versión no registra compras a crédito.');
 if(totals.total>funds.available&&!confirm('La compra utiliza parte de tu reserva de efectivo. ¿Deseas continuar?'))throw Error('Compra cancelada. Tu reserva se mantiene.');
 store.products.push(...newProducts);
 for(const {product,item} of entries){
  const newQty=product.stock+item.qty;
  product.avgCost=(product.stock*product.avgCost+item.total)/newQty;
  product.stock=newQty;
  store.purchases.push(item);
 }
 saveLocal();
 render();
}
async function saveSale(form){const productId=form.get('productId'),product=store.products.find(p=>p.id===productId);if(!product)throw Error('Selecciona una prenda válida.');const qty=num(form.get('qty')),price=rounded(form.get('price')),discount=rounded(form.get('discount')),paidAmount=rounded(form.get('paidAmount')),shippingCollected=rounded(form.get('shippingCollected')),deliveryCost=rounded(form.get('deliveryCost')),packagingCost=rounded(form.get('packagingCost'));if(!Number.isInteger(qty)||qty<=0)throw Error('La cantidad debe ser un entero positivo.');if(qty>product.stock)throw Error(`Solo quedan ${product.stock} prendas disponibles.`);if([price,discount,paidAmount,shippingCollected,deliveryCost,packagingCost].some(v=>v<0))throw Error('Los importes no pueden ser negativos.');const total=rounded(price*qty-discount+shippingCollected);if(discount>rounded(price*qty)||paidAmount>total)throw Error('Revisa el descuento y el cobro: no pueden superar la venta.');
 const s={date:form.get('date'),productId,productName:product.name,size:product.size,color:product.color,qty,price,discount,paidAmount,shippingCollected,deliveryCost,packagingCost,customer:String(form.get('customer')||'').trim(),channel:form.get('channel'),status:'entregada',costAtSale:product.avgCost};
 product.stock-=qty;store.sales.push({id:id(),...s,recordedBy:activeProfile()?.name??null});saveLocal();render();}
async function saveSettings(form){const s={businessName:String(form.get('businessName')||'Emprendiendo en Pareja').trim(),capital:rounded(form.get('capital')),reserve:rounded(form.get('reserve')),minimum:num(form.get('minimum')),discount:rounded(form.get('discount'))};if(s.capital<0||s.reserve<0||s.minimum<1||s.discount<0||!Number.isInteger(s.minimum))throw Error('Revisa los valores de configuración.');store.settings=s;saveLocal();Object.assign(sim,{capital:s.capital,reserve:s.reserve,min:s.minimum,discount:s.discount});render();}
function exportCSV(kind){const data=kind==='products'?store.products:kind==='sales'?store.sales:kind==='purchases'?store.purchases:store.expenses;const keys=[...new Set(data.flatMap(x=>Object.keys(x)))];if(!keys.length){toast('No hay registros para exportar.');return;}const csv='\uFEFF'+[keys.join(','),...data.map(r=>keys.map(k=>'"'+String(typeof r[k]==='string'&&/^[\s]*[=+@-]|^[\t\r\n]/.test(r[k])?"'"+r[k]:r[k]??'').replaceAll('"','""')+'"').join(','))].join('\r\n');download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`${kind}-${today()}.csv`);}

async function prepareAd(productId){
 const product=store.products.find(p=>p.id===productId);
 if(!product)return;
 showDialog('Preparar anuncio',`
 <div class="field"><label for="ad-text">Texto para Facebook</label><textarea id="ad-text" rows="6">${escapeHtml(adText(product,money(product.price)))}</textarea></div>
 <button type="button" class="primary small" id="copy-ad">Copiar texto</button>
 <div class="field" style="margin-top:16px"><label for="ad-files">Agregar fotos de la prenda</label><input type="file" id="ad-files" accept="image/*" multiple></div>
 <p class="hint">Hasta tres fotos por prenda. Se guardan en este dispositivo. Guarda las que quieras adjuntar.</p>
 <div id="ad-photos" class="ad-photos" aria-live="polite"></div>
 <div class="field" style="margin-top:16px"><label for="ad-group">Enlace del grupo de Facebook</label><input type="url" id="ad-group" placeholder="https://www.facebook.com/groups/…"></div>
 <div class="field"><label for="ad-groups">Grupos guardados</label><select id="ad-groups"></select></div>
 <button type="button" class="secondary small" id="ad-save-group">Guardar grupo</button>
 <a class="secondary small" id="ad-open-group" href="https://www.facebook.com/groups/">Abrir Facebook</a>
 <p class="hint">En Facebook pega el texto, adjunta las fotos y publica.</p>`);
 const modal=document.querySelector('#modal'), photosHolder=modal.querySelector('#ad-photos');
 const ad=modal.querySelector('#ad-text'), picker=modal.querySelector('#ad-files');
 const group=modal.querySelector('#ad-group'), groups=modal.querySelector('#ad-groups'), open=modal.querySelector('#ad-open-group');
 let photos=[];
 function groupOptions(){
  const stored=(store.adGroups??[]).map(facebookGroup).filter(Boolean);
  groups.replaceChildren(new Option('Selecciona un grupo',''),...stored.map(url=>new Option(new URL(url).pathname.split('/')[2],url)));
 }
 function updateLink(){open.href=facebookGroup(group.value)??'https://www.facebook.com/groups/';}
 groupOptions();
 group.oninput=updateLink;
 groups.onchange=()=>{group.value=groups.value;updateLink();};
 modal.querySelector('#ad-save-group').onclick=()=>{
  const url=facebookGroup(group.value);
  if(!url){toast('Pega el enlace directo de un grupo de Facebook.');return;}
  try{
   store.adGroups=[...new Set([...(store.adGroups??[]),url])];
   saveLocal();
   groupOptions();
   groups.value=url;
   updateLink();
   toast('Grupo guardado.');
  }catch(error){toast(errorMessage(error));}
 };
 modal.querySelector('#copy-ad').onclick=async()=>{
  try{
   if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(ad.value);
   else {ad.focus();ad.select();if(!document.execCommand('copy'))throw Error();}
   toast('Texto copiado.');
  }catch{
   ad.focus();ad.select();
   if(document.execCommand('copy'))toast('Texto copiado.');
   else toast('Mantén presionado el texto seleccionado y toca Copiar.');
  }
 };
 function renderPhotos(){
  photosHolder.replaceChildren(...photos.map((photo,index)=>{
   const card=document.createElement('div'), image=document.createElement('img');
   const save=document.createElement('button'), remove=document.createElement('button');
   const url=URL.createObjectURL(photo);
   image.alt=`Foto ${index+1} de la prenda`;
   image.onload=image.onerror=()=>URL.revokeObjectURL(url);
   image.src=url;
   save.type=remove.type='button';
   save.className=remove.className='secondary small';
   save.textContent='Guardar foto'; remove.textContent='Quitar';
   save.onclick=()=>download(photo,`prenda-${product.id}-${index+1}.jpg`);
   remove.onclick=async()=>{
    picker.disabled=true;
    for(const button of photosHolder.querySelectorAll('button'))button.disabled=true;
    try{photos=await productPhotos(productId,photos.filter((_,i)=>i!==index));}
    catch(error){toast('No se pudo quitar la foto.');}
    finally{picker.disabled=false;renderPhotos();}
   };
   card.append(image,save,remove);
   return card;
  }));
 }
 picker.disabled=true;
 try{photos=await productPhotos(productId);renderPhotos();}
 catch{toast('No se pueden leer las fotos de este dispositivo.');return;}
 picker.disabled=false;
 picker.onchange=async()=>{
  const files=[...picker.files];
  picker.value='';
  if(!files.length)return;
  if(files.length+photos.length>3){toast('Puedes guardar hasta tres fotos por prenda.');return;}
  picker.disabled=true;
  for(const button of photosHolder.querySelectorAll('button'))button.disabled=true;
  try{
   const next=[...photos];
   for(const file of files)next.push(await compressPhoto(file));
   photos=await productPhotos(productId,next);
  }catch{toast('No se pudieron guardar las fotos. Elige imágenes JPG o PNG de hasta 25 MB.');}
  finally{picker.disabled=false;renderPhotos();}
 };
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function exportAll(){const out={exportedAt:new Date().toISOString(),mode:'local',...store};download(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),`respaldo-negocio-ropa-${today()}.json`);}
function closeModal(){document.getElementById('modal')?.close();}
async function actionClick(button){const action=button.dataset.action;if(action==='navigate'){current=button.dataset.view;render();window.scrollTo({top:0,behavior:'instant'});return;}if(action==='close'){closeModal();return;}if(action==='new-product')return dialogProduct();if(action==='prepare-ad')return prepareAd(button.dataset.id);if(action==='edit-price')return dialogEditPrice(button.dataset.id);if(action==='new-sale')return dialogSale();if(action==='new-purchase')return dialogPurchase();if(action==='new-expense')return dialogExpense();if(action==='add-line'){const lines=getPurchaseLines();lines.push({});document.querySelector('#purchase-lines').innerHTML=lines.map((line,i)=>purchaseLine(i,line)).join('');updateOrderSummary();return;}if(action==='remove-line'){const lines=getPurchaseLines();lines.splice(num(button.dataset.index),1);document.querySelector('#purchase-lines').innerHTML=lines.map((line,i)=>purchaseLine(i,line)).join('');updateOrderSummary();return;}if(action==='export')return exportCSV(button.dataset.kind);if(action==='export-all')return exportAll();}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;try{await actionClick(b);}catch(err){toast(errorMessage(err));console.error(err);}});
document.addEventListener('change',e=>{if(e.target.id==='active-profile'){
  try{store.activeProfileId=e.target.value||null;saveLocal();render();}
  catch(err){toast(errorMessage(err));}
  return;
 }if(e.target.id==='sale-product'){const p=store.products.find(p=>p.id===e.target.value);if(p){const price=document.querySelector('#sale-form [name=price]'),paid=document.querySelector('#sale-form [name=paidAmount]');if(price)price.value=p.price;const f=price?.form;if(paid&&!f.dataset.paidTouched)paid.value=Math.max(0,rounded(p.price*num(f.elements.qty.value)-num(f.elements.discount.value)+num(f.elements.shippingCollected.value)));}}if(e.target.classList.contains('line-product')){const line=e.target.closest('.line-item'),p=store.products.find(x=>x.id===e.target.value);const details=line.querySelector('.line-details');
  details.hidden=Boolean(e.target.value);
  details.querySelectorAll('input').forEach(input=>{input.disabled=details.hidden;});
  line.querySelector('.line-price').value=p?.listCost??'';}if(e.target.closest('#purchase-form'))updateOrderSummary();});
document.addEventListener('input',e=>{if(e.target.dataset.sim){const k=e.target.dataset.sim;sim[k]=num(e.target.value);document.querySelector(`#simval-${k}`).textContent=['vestQty','jacketQty','min'].includes(k)?sim[k]:money(sim[k]);document.querySelector('#sim-result').innerHTML=simOutput();}if(e.target.id==='search'){const needle=e.target.value.trim().toLowerCase();document.querySelectorAll('tr[data-search]').forEach(tr=>tr.hidden=!tr.dataset.search.includes(needle));}if(e.target.closest('#purchase-form'))updateOrderSummary();if(e.target.closest('#sale-form')&&['price','qty','discount','shippingCollected'].includes(e.target.name)){const f=e.target.closest('form');if(!f.dataset.paidTouched){f.elements.paidAmount.value=Math.max(0,rounded(num(f.elements.qty.value)*num(f.elements.price.value)-num(f.elements.discount.value)+num(f.elements.shippingCollected.value)));}}if(e.target.name==='paidAmount'&&e.target.closest('#sale-form'))e.target.closest('form').dataset.paidTouched='1';});
document.addEventListener('submit',async e=>{if(!['product-form','purchase-form','sale-form','expense-form','settings-form','profile-form','edit-price-form'].includes(e.target.id))return;e.preventDefault();const form=e.target,data=new FormData(form),btn=form.querySelector('[type=submit]');btn.disabled=true;try{switch(form.id){case'profile-form':addProfile(data);break;case'product-form':await addProduct(data);break;case'edit-price-form':await savePrice(data);break;case'purchase-form':await savePurchase(data);break;case'sale-form':await saveSale(data);break;case'expense-form':await addExpense(data);break;case'settings-form':await saveSettings(data);break;}if(form.id!=='profile-form'&&form.id!=='settings-form')closeModal();toast('Información guardada correctamente.');}catch(err){toast(errorMessage(err));console.error(err);}finally{if(btn.isConnected)btn.disabled=false;}});
function boot(){
 try{loadLocal();render();}
 catch{
  document.querySelector('#app').textContent='No se pudieron leer los registros de este navegador. Revisa los permisos de almacenamiento.';
 }
 if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js').catch(console.warn);
}
boot();
