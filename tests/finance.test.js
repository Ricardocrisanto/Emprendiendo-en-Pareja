import test from 'node:test';
import assert from 'node:assert/strict';
import {starterDemo,derive,simulation,orderTotals,purchaseLineCosts,allocateUnits} from '../public/core.js';
test('compra con 10 prendas mezcladas y descuento de 50',()=>{
 const r=orderTotals([{qty:5,unitPrice:270},{qty:5,unitPrice:319}],10,50,0);
 assert.equal(r.total,2445);assert.equal(r.savings,500);assert.equal(r.eligible,true);
});
test('sin mínimo no se descuenta',()=>{
 assert.equal(orderTotals([{qty:9,unitPrice:270}],10,50,0).discount,0);
});
test('simulador proyecta escenarios sin confundir stock',()=>{
 const s=simulation({vestQty:5,jacketQty:5,vestPrice:320,jacketPrice:390,capital:4000,reserve:1000,min:10,discount:50,costPerSale:15,fixedCost:100});
 assert.equal(s.investment,2445);
 assert.deepEqual(s.scenarios.map(x=>x.sumSold),[4,7,10]);
 assert.equal(s.scenarios.at(-1).profit,855);
 assert.equal(s.scenarios.at(-1).leftCost,0);
});
test('inventario valorizado no es gasto hasta venta',()=>{
 const demo=starterDemo();const m=derive(demo);
 assert.equal(m.inventory,2445);assert.equal(m.profit,0);assert.equal(m.cash,1555);assert.equal(m.available,555);
});
test('reconoce utilidad, caja y dinero por cobrar por separado',()=>{
 const demo=starterDemo();demo.products[0].stock--;
 demo.sales.push({qty:1,price:320,discount:0,shippingCollected:0,paidAmount:100,costAtSale:220,deliveryCost:20,packagingCost:10,status:'entregada'});
 const m=derive(demo);
 assert.equal(m.profit,70);assert.equal(m.cash,1625);assert.equal(m.pendingCollections,220);
});
test('asignación de unidades redondea al total objetivo',()=>{
 assert.deepEqual(allocateUnits(10,.7,[5,5]),[3,4]);
});
test('el reparto de envío conserva el total al centavo',()=>{
 const lines=[{qty:5,unitPrice:270},{qty:5,unitPrice:319}];
 const order=orderTotals(lines,10,50,0.03);
 const items=purchaseLineCosts(lines,order);
 assert.deepEqual(items.map(item=>item.total),[1100.02,1345.01]);
 assert.equal(items.reduce((sum,item)=>sum+Math.round(item.total*100),0),Math.round(order.total*100));
});
