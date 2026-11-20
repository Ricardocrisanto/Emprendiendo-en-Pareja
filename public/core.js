// Funciones financieras sin dependencias: también son comprobables con Node.js.
export const defaultSettings = {
  capital: 4000, reserve: 1000, minimum: 10, discount: 50,
  businessName: 'Emprendiendo en Pareja'
};
export const sum = values => values.reduce((a,b) => a+(Number(b)||0),0);
export const money = value => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:2}).format(Number(value)||0);
export const num = value => Number(value) || 0;
export const rounded = value => Math.round((Number(value)+Number.EPSILON)*100)/100;
export const currentMonth = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export function productsInventory(products){
 return products.reduce((s,p)=>s+num(p.stock)*num(p.avgCost),0);
}
export function derive(state){
 const activeSales=state.sales.filter(s=>s.status!=='cancelada');
 const revenue=sum(activeSales.map(s=>num(s.price)*num(s.qty)-num(s.discount)+num(s.shippingCollected)));
 const costOfGoods=sum(activeSales.map(s=>rounded(num(s.costAtSale)*num(s.qty))));
 const saleCosts=sum(activeSales.map(s=>num(s.deliveryCost)+num(s.packagingCost)));
 const expenses=sum(state.expenses.map(e=>e.amount));
 const purchases=sum(state.purchases.map(p=>p.total));
 const received=sum(activeSales.map(s=>s.paidAmount));
 const capital=num(state.settings.capital),reserve=num(state.settings.reserve);
 const cash=rounded(capital+received-purchases-expenses-saleCosts);
 const profit=rounded(revenue-costOfGoods-saleCosts-expenses);
 const inventory=rounded(productsInventory(state.products));
 const stock=sum(state.products.map(p=>p.stock));
 const pendingCollections=rounded(sum(activeSales.map(s=>Math.max(0,num(s.price)*num(s.qty)-num(s.discount)+num(s.shippingCollected)-num(s.paidAmount)))));
 return {revenue:rounded(revenue),costOfGoods:rounded(costOfGoods),saleCosts:rounded(saleCosts),expenses:rounded(expenses),purchases:rounded(purchases),received:rounded(received),cash,profit,inventory,stock,pendingCollections,available:rounded(cash-reserve),margin: revenue ? rounded(profit/revenue*100):0,itemsSold:sum(activeSales.map(s=>s.qty)),salesCount:activeSales.length};
}
export function orderTotals(lines,minimum=10,discount=50,shipping=0){
 const eligible=sum(lines.map(l=>l.qty))>=minimum;
 const {qty,discount:effective,savings,merchandise,total,shipping:freight}=purchaseTotals(lines,eligible?discount:0,shipping);
 return {qty,eligible,discount:effective,savings,merchandise,total,shipping:freight};
}
export function purchaseTotals(lines,discount=0,shipping=0){
 const qty=sum(lines.map(l=>l.qty));
 const subtotal=rounded(sum(lines.map(l=>num(l.qty)*num(l.unitPrice))));
 const savings=rounded(qty*discount);
 const merchandise=rounded(subtotal-savings);
 return {qty,subtotal,discount,savings,merchandise,total:rounded(merchandise+num(shipping)),shipping:num(shipping)};
}
// Assign shipping in cents so the saved lines add up to the order total.
export function purchaseLineCosts(lines, totals){
 const shippingCents=Math.round(totals.shipping*100);
 let units=0, allocated=0;
 return lines.map(line=>{
   units+=line.qty;
   const cumulative=Math.round(shippingCents*units/totals.qty);
   const total=rounded(line.qty*(line.unitPrice-totals.discount)+(cumulative-allocated)/100);
   allocated=cumulative;
   return {total,unitCost:total/line.qty};
 });
}
export function allocateUnits(totalQty,rate,quantities){
 if(totalQty<=0) return quantities.map(()=>0);
 const target=Math.max(0,Math.min(totalQty,Math.round(totalQty*rate)));
 const desired=quantities.map(q=>q*rate), out=desired.map(d=>Math.floor(d));
 let left=target-sum(out);
 const indices=quantities.map((_,i)=>i).sort((a,b)=>(desired[b]-out[b])-(desired[a]-out[a])||b-a);
 for (const i of indices){ if(left<=0) break; if(out[i]<quantities[i]){out[i]++;left--;} }
 return out;
}
export function simulation(p){
 const products=p.products??[
  {qty:p.vestQty,cost:270,price:p.vestPrice},
  {qty:p.jacketQty,cost:319,price:p.jacketPrice}
 ];
 const quantities=products.map(product=>Math.max(0,Math.floor(num(product.qty))));
 const count=sum(quantities), minimum=num(p.min), discount=count>=minimum?num(p.discount):0;
 const costs=products.map(product=>rounded(num(product.cost)-discount));
 const prices=products.map(product=>num(product.price));
 const variablePerUnit=rounded(Array.isArray(p.variableExpenses)?sum(p.variableExpenses.map(expense=>expense.amount)):num(p.costPerSale));
 const fixed=rounded(Array.isArray(p.fixedExpenses)?sum(p.fixedExpenses.map(expense=>expense.amount)):num(p.fixedCost));
 const investment=rounded(sum(quantities.map((q,i)=>q*costs[i])));
 const scenarios=[{name:'Conservador',rate:.4},{name:'Intermedio',rate:.7},{name:'Favorable',rate:1}].map(s=>{
   const sold=allocateUnits(count,s.rate,quantities);
   const revenue=rounded(sum(sold.map((q,i)=>q*prices[i])));
   const soldCost=rounded(sum(sold.map((q,i)=>q*costs[i])));
   const variable=rounded(sum(sold)*variablePerUnit);
   const profit=rounded(revenue-soldCost-variable-fixed);
   const leftCost=rounded(investment-soldCost);
   const cash=rounded(num(p.capital)-investment+revenue-variable-fixed);
   return {...s,sold,sumSold:sum(sold),revenue,soldCost,variable,fixed,profit,leftCost,cash};
 });
 return {count,discount,costs,prices,investment,variablePerUnit,fixed,canBuy: investment<=num(p.capital)-num(p.reserve),capitalAfterPurchase:rounded(num(p.capital)-investment),scenarios};
}
export function starterDemo(){
 const a='sku-hm',b='sku-hg',c='sku-lm',d='sku-lg';
 const products=[
  {id:a,sku:'HUM-ROS-M',name:'Chaleco Humana',size:'M',color:'Rosa',category:'Chalecos',price:320,listCost:270,stock:3,avgCost:220},
  {id:b,sku:'HUM-ROS-G',name:'Chaleco Humana',size:'G',color:'Rosa',category:'Chalecos',price:320,listCost:270,stock:2,avgCost:220},
  {id:c,sku:'LAU-ROS-M',name:'Chamarra Laura',size:'M',color:'Rosa',category:'Chamarras',price:390,listCost:319,stock:3,avgCost:269},
  {id:d,sku:'LAU-ROS-G',name:'Chamarra Laura',size:'G',color:'Rosa',category:'Chamarras',price:390,listCost:319,stock:2,avgCost:269}
 ];
 const purchases=products.map(p=>({id:'p-'+p.id,orderId:'EJEMPLO-001',date:today(),productId:p.id,productName:p.name,qty:p.stock,unitCost:p.avgCost,total:rounded(p.avgCost*p.stock)}));
 return {products,purchases,sales:[],expenses:[],settings:{...defaultSettings}};
}
