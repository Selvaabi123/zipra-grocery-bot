function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function json(v) {
  return JSON.stringify(v).replace(/</g, "\\u003c");
}

function shell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<meta name="theme-color" content="#ff6b00">
<title>${esc(title)} · ZIPRA</title>
<style>
:root{--brand:#ff6b00;--brand-dk:#e8590c;--brand-lt:#fff4ea;--bg:#fff8f1;--card:#fff;--ink:#27221e;--muted:#9a8f83;--line:#f3e7d8;--ok:#e5f6ec;--ok-in:#176b3a}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;font-synthesis:none}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
.bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);padding:10px 14px calc(10px + env(safe-area-inset-bottom));z-index:40;box-shadow:0 -6px 18px rgba(120,60,0,.08)}
.bar .inner{max-width:520px;margin:0 auto;display:flex;align-items:center;gap:12px}
.bar .sum{min-width:0;flex:1;font-size:12px;color:var(--muted)}
.bar .sum b{color:var(--ink);font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.btn{background:var(--brand);color:#fff;border:none;border-radius:14px;padding:13px 22px;font-size:15px;font-weight:700;cursor:pointer;text-align:center;box-shadow:0 4px 12px rgba(255,107,0,.25)}
.btn:disabled{opacity:.5;box-shadow:none}
.btn.ghost{background:#fff;border:1px solid var(--line);color:#54483a;box-shadow:none}
.btn.green{background:#25d366;box-shadow:0 4px 12px rgba(37,211,102,.25)}
.row{display:flex;justify-content:space-between;font-size:14px;margin:6px 0;color:#43372b;gap:12px}
.row.total{font-size:16px;font-weight:800;border-top:1px solid var(--line);padding-top:8px;margin-top:8px}
.okb{background:var(--ok);border:1px solid #bcdcc7;color:var(--ok-in);border-radius:14px;padding:14px;margin:12px 0;font-size:14px;line-height:1.5}
.errb{background:#fdeee7;border:1px solid #f1c9a8;color:#9c4010;border-radius:14px;padding:14px;margin:12px 0;font-size:14px;line-height:1.5}
.field{margin:12px 0}
.field input,.field textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;font-size:15px;background:#fffdf9}
.zero{text-align:center;padding:60px 20px;color:var(--muted)}
.zero .big{font-size:48px}
.back{background:none;border:none;color:inherit;font-size:22px;cursor:pointer;line-height:1;padding:0 4px}
a{color:inherit}
@keyframes pop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

/* ------------------------------ SHOP ------------------------------ */
function shopPage(base) {
  return shell(
    "ZIPRA Grocery",
    `<style>
.hdr{background:linear-gradient(135deg,#ff7a18 0%,#ff4d00 60%,#e8470a 100%);color:#fff;padding:18px 16px 52px;border-radius:0 0 28px 28px}
.hdr .top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.hdr .logo{font-weight:800;font-size:20px;letter-spacing:.5px}
.hdr .logo span{color:#ffd9b8}
.hdr .tag{font-size:12px;opacity:.92;margin-top:2px}
.hdr .del{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.16);padding:7px 12px;border-radius:999px;font-size:12px;font-weight:600}
main{max-width:520px;margin:-34px auto 0;padding:0 14px 130px;position:relative;z-index:1}
.search{margin-bottom:14px}
.search input{width:100%;border:none;border-radius:16px;padding:13px 16px;font-size:15px;background:#fff;box-shadow:0 6px 16px rgba(120,60,0,.08);outline:none}
.chips{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 12px;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chip{white-space:nowrap;border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 15px;font-size:13px;font-weight:600;color:#6d5f4f}
.chip.on{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:0 3px 10px rgba(255,107,0,.3)}
.prod{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:10px;margin-bottom:12px;display:flex;gap:12px;align-items:center;box-shadow:0 2px 8px rgba(120,60,0,.05);animation:pop .2s ease}
.prod img{width:74px;height:74px;border-radius:14px;object-fit:cover;background:#f7efe4;flex:none}
.prod .info{flex:1;min-width:0}
.prod .name{font-weight:700;font-size:14.5px;line-height:1.25}
.prod .unit{font-size:12px;color:var(--muted);margin-top:2px}
.prod .price{font-weight:800;color:var(--brand-dk);font-size:15px;margin-top:5px}
.prod .price .was{color:#b4a696;text-decoration:line-through;font-weight:500;font-size:12px;margin-left:5px}
.badge-stock{display:inline-block;font-size:10px;font-weight:700;border-radius:999px;padding:2px 7px;margin-top:4px;background:#fff3e0;color:#c26a17}
.badge-stock.low{background:#fdecee;color:#c62828}
.qty{display:flex;align-items:center;gap:9px;background:#fff4ea;border-radius:12px;padding:4px}
.qty button{width:30px;height:30px;border-radius:9px;border:none;background:#fff;color:var(--brand-dk);font-size:18px;font-weight:800;line-height:1;cursor:pointer;box-shadow:0 1px 4px rgba(120,60,0,.15)}
.qty .n{min-width:24px;text-align:center;font-weight:800;font-size:14.5px}
.add{width:36px;height:36px;border-radius:12px;background:var(--brand);border:none;color:#fff;font-size:20px;line-height:1;cursor:pointer;font-weight:700;box-shadow:0 3px 8px rgba(255,107,0,.35)}
.count{background:#fff;border:1px solid var(--line);border-radius:999px;min-width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--brand-dk);margin-left:6px;padding:0 6px}
.foot{text-align:center;font-size:12px;color:var(--muted);padding:18px 0 8px}
</style>
<header class="hdr">
  <div class="top">
    <div><div class="logo">ZIPRA<span> Grocery</span></div><div class="tag">Fresh Groceries. Faster Deliveries.</div></div>
    <div class="del">🛵 Delivery <span id="feeChip"></span></div>
  </div>
</header>
<main>
  <div id="errbox" class="errb" style="display:none"></div>
  <div id="notice" class="okb" style="display:none"></div>
  <div class="search"><input id="q" type="search" placeholder="🔍 Search products…" autocomplete="off"></div>
  <div id="chips" class="chips"></div>
  <div id="products"></div>
  <div id="zero" class="zero" style="display:none"><div class="big">🛒</div><p>Nothing here yet.</p></div>
  <div class="foot">ZIPRA Grocery · Below link open panna WhatsApp-la order + payment varum ✨</div>
</main>
<div class="bar" id="bar" style="display:none">
  <div class="inner">
    <div class="sum"><b id="barSub">Cart</b><span id="barCount">Add items to get started</span></div>
    <button class="btn" id="checkoutBtn">Checkout →</button>
  </div>
</div>
<script>
var BASE=${json(base)};
var TOKEN=new URLSearchParams(location.search).get("f")||"";
var state={cat:"",q:"",cart:{},catalog:{categories:[],deliveryFee:30},waPhone:"",busy:false};
function money(n){return "₹"+Number(n||0).toLocaleString("en-IN");}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function price(p){return p.effectivePrice&&p.effectivePrice>0?p.effectivePrice:p.price;}
function stockBadge(p){
  if(p.stock<=0||!p.available)return "";
  return p.stock<=p.lowStockLevel?'<span class="badge-stock low">Only '+p.stock+' left 🔥</span>':'';
}
function prodHtml(c,$p){
  var img=$p.image?'<img src="'+esc($p.image)+'" loading="lazy" alt="'+esc($p.item)+'">':'';
  if($p.stock<=0||!$p.available){
    return '<div class="prod" style="opacity:.6">'+img+'<div class="info"><span class="name">'+esc($p.item)+'</span><div class="unit">'+esc($p.unit)+' · Out of stock</div></div><span class="badge-stock low">Sold out</span></div>';
  }
  var pp=price($p),q=state.cart[$p.id]||0;
  var ctrl=q>0?'<span class="qty"><button onclick="dec('+$p.id+')">−</button><span class="n">'+q+'</span><button onclick="inc('+$p.id+')">+</button></span>':'<button class="add" onclick="inc('+$p.id+')">+</button>';
  return '<div class="prod">'+img+'<div class="info"><span class="name">'+esc($p.item)+'</span><div class="unit">'+esc($p.unit)+'</div><div class="price">'+money(pp)+(pp<$p.price?'<span class="was">'+money($p.price)+'</span>':'')+stockBadge($p)+'</div></div>'+ctrl+'</div>';
}
function catPill(c,i){
  var on=c.name===state.cat?" on":"";
  return '<span class="chip'+on+'" onclick="setCat('+i+')">'+esc(c.name)+'<span class="count">'+c.products.length+'</span></span>';
}
function render(){
  if(!state.cat&&state.catalog.categories[0])state.cat=state.catalog.categories[0].name;
  document.getElementById("chips").innerHTML=state.catalog.categories.map(catPill).join("");
  var cur=state.catalog.categories.filter(function(c){return c.name===state.cat;})[0]||{products:[]};
  var list=cur.products.filter(function(p){return !state.q||p.item.toLowerCase().indexOf(state.q)>-1;});
  document.getElementById("products").innerHTML=list.map(function(p){return prodHtml(state.cat,p);}).join("");
  document.getElementById("zero").style.display=list.length?"none":"block";
  updateBar();
}
window.setCat=function(i){state.cat=state.catalog.categories[i]&&state.catalog.categories[i].name;render();};
window.inc=function(id){state.cart[id]=(state.cart[id]||0)+1;render();};
window.dec=function(id){state.cart[id]=(state.cart[id]||0)-1;if(state.cart[id]<=0)delete state.cart[id];render();};
document.getElementById("q").addEventListener("input",function(e){state.q=e.target.value.toLowerCase();render();});
function cartItems(){var out=[];state.catalog.categories.forEach(function(c){c.products.forEach(function(p){if(state.cart[p.id])out.push({productId:p.id,item:p.item,unit:p.unit,price:price(p),qty:state.cart[p.id]});});});return out;}
function updateBar(){
  var items=cartItems();
  document.getElementById("feeChip").textContent=state.catalog.deliveryFee?money(state.catalog.deliveryFee)+" delivery":"Free delivery";
  if(!items.length){document.getElementById("bar").style.display="none";return;}
  var sub=items.reduce(function(s,i){return s+i.price*i.qty;},0);
  document.getElementById("bar").style.display="block";
  document.getElementById("barSub").textContent=items.length+" item(s) · "+money(sub);
  document.getElementById("barCount").textContent="+ delivery "+money(state.catalog.deliveryFee)+" = "+money(sub+state.catalog.deliveryFee);
}
window.jumpToWhatsApp=function(phone,text){
  // Metro-style: selection happened in the shop; next step is WhatsApp where
  // the order + 💳 PAY NOW are already waiting. Open the chat directly:
  //  - Normal mobile browser → whatsapp:// deep link opens the app right away.
  //  - Desktop → wa.me (WhatsApp Web / app).
  //  - WhatsApp in-app browser → a page is NOT allowed to switch into the app,
  //    so we don't force a broken redirect; the customer closes this view and
  //    the 💳 PAY NOW card is already the latest message in the chat.
  var msg=encodeURIComponent(text);
  var ua=(navigator.userAgent||"").toLowerCase();
  var inWA=/(^|[^a-z])w\/\d|whatsapp/i.test(ua)||/wa[a-z0-9._\/-]*webview/i.test(ua);
  var mob=/(android|iphone|ipad|mobile)/i.test(ua);
  if(inWA)return;
  if(mob){
    var jumped=false;
    window.addEventListener("blur",function(){jumped=true;});
    setTimeout(function(){if(!jumped)window.location.href="https://wa.me/"+phone+"?text="+msg;},1600);
    window.location.href="whatsapp://send?phone="+phone+"&text="+msg;
  }else{
    window.location.href="https://wa.me/"+phone+"?text="+msg;
  }
};
document.getElementById("checkoutBtn").addEventListener("click",function(){
  var items=cartItems();
  if(!items.length||state.busy)return;
  if(!TOKEN){showErr("⚠️ Please open this shop from your <b>WhatsApp</b> chat link — the checkout is tied to your WhatsApp so Pay Now can be sent right there.","errbox");return;}
  state.busy=true;var btn=this;btn.disabled=true;btn.textContent="Placing…";
  fetch(BASE+"/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:TOKEN,items:items})})
  .then(function(r){return r.json().catch(function(){return{ok:false,error:"Server error"}}).then(function(d){return {st:r.status,d:d};});})
  .then(function(res){
    if(res.d.ok){
      var order=res.d.order||{};
      state.cart={};render();
      document.getElementById("bar").style.display="none";
      if(state.waPhone){
        jumpToWhatsApp(state.waPhone,"Hi ZIPRA! 👋 I placed Order "+order.id+" — sending payment now 💳");
      }else{
        showErr("Order <b>"+esc(order.id)+"</b> placed. Open WhatsApp and tap <b>💳 PAY NOW</b> to pay — we confirm your payment automatically.","errbox");
      }
    }else{
      showErr((res.d.error||"Checkout failed.")+"","errbox");
      if(res.st===401&&!TOKEN){/* tokenless */ }
    }
  })
  .catch(function(){showErr("Network error during checkout.","errbox");})
  .finally(function(){state.busy=false;btn.disabled=false;btn.textContent="Checkout →";});
});
function showErr(html,id){var el=document.getElementById(id);el.innerHTML=html;el.style.display="block";}
fetch(BASE+"/api/store/catalog").then(function(r){return r.json();}).then(function(d){state.catalog=d;state.waPhone=(d.waPhone||"");state.catalog.categories.forEach(function(c,i){c.idx=i;});render();})
.catch(function(){showErr("Couldn't load the store. Check your connection.","errbox");});
</script>`
  );
}

/* ------------------------------ PAY ------------------------------ */
function payPage(base, order, opts) {
  opts = opts || {};
  const only = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const hasUpi = !!opts.upiLink;
  const payLabel = hasUpi ? `Continue to Pay ${only(order.total)}` : opts.paymentLink ? "Continue to Payment" : "Continue";
  return shell(
    `Pay Order ${order.id}`,
    `<style>
.main{max-width:480px;margin:0 auto;padding:0 14px 40px}
.hdr{background:linear-gradient(135deg,#16a34a 0%,#0f7a35 100%);color:#fff;padding:16px 16px 40px;border-radius:0 0 28px 28px}
.hdr .top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.hdr .logo{font-weight:800;font-size:20px;letter-spacing:.5px}
.hdr .logo span{color:#c9f2d9}
.hdr .sub{font-size:12px;opacity:.92;margin-top:2px}
.amount{background:#fff;border:1px solid var(--line);border-radius:20px;padding:18px;margin:-26px 0 14px;position:relative;text-align:center;box-shadow:0 8px 24px rgba(15,122,53,.12)}
.amount .lbl{font-size:12px;color:var(--muted);font-weight:600;letter-spacing:.3px}
.amount .am{font-size:38px;font-weight:800;color:#0f7a35;line-height:1.1;margin:4px 0 2px}
.amount .ordNo{font-size:12.5px;color:var(--muted)}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,.03)}
.card h2{font-size:15px;margin:0 0 8px}
.apps{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.app{border:1px solid var(--line);background:#fdfaf5;border-radius:12px;padding:8px 12px;font-size:12.5px;font-weight:700;color:#3a332b}
.app .ic{opacity:.85;margin-right:4px}
.paybtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;background:#25d366;color:#fff;border:none;border-radius:17px;padding:17px;font-size:17px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(37,211,102,.35)}
.paybtn:disabled{opacity:.45;box-shadow:none;cursor:not-allowed}
.paybtn svg{flex:none}
.note{font-size:12px;color:var(--muted);text-align:center;margin-top:10px;line-height:1.5}
.upiid{display:flex;align-items:center;gap:8px;background:#fff;border:1px dashed #25d366;border-radius:14px;padding:12px;font-weight:700;color:#0f7a35;font-size:14px}
.upiid button{margin-left:auto;border:none;background:#25d366;color:#fff;border-radius:9px;padding:8px 13px;font-weight:700;cursor:pointer}
.tryaga{background:#fdeee7;border:1px solid #f1c9a8;color:#9c4010;border-radius:14px;padding:14px;margin:12px 0;font-size:14px;line-height:1.5}
.payok{text-align:center;padding:26px 10px}
.payok .chk{font-size:52px}
.payok h2{font-size:19px;margin:10px 0 4px;color:#176b3a}
.payok p{font-size:14px;color:var(--muted);margin:0;line-height:1.55}
</style>
<header class="hdr">
  <div class="top">
    <div><div class="logo">ZIPRA<span> Pay</span></div><div class="sub">Secure UPI payment · Order ${esc(order.id)}</div></div>
  </div>
</header>
<div class="main">
  <div id="paywrap">
    <div class="amount">
      <div class="lbl">AMOUNT TO PAY</div>
      <div class="am">${only(order.total)}</div>
      <div class="ordNo">Order #${esc(order.id)}</div>
    </div>
    <div class="card">
      <h2>🧾 Order details</h2>
      <div id="items">${order.items.map((i) => `<div class="row"><span>${esc(i.item)} × ${i.qty} ${esc(i.unit)}</span><span>${only(i.subtotal)}</span></div>`).join("")}</div>
      <div class="row"><span>Subtotal</span><span>${only(order.subtotal)}</span></div>
      <div class="row"><span>Delivery</span><span>${only(order.deliveryFee)}</span></div>
      <div class="row total"><span>Grand Total</span><span>${only(order.total)}</span></div>
    </div>
    ${hasUpi
      ? `<div class="card" style="padding:14px">
          <div style="font-size:13px;font-weight:700;color:#3a332b">Pay with your preferred UPI app</div>
          <div class="apps">
            <span class="app"><span class="ic">🇺</span>Google Pay</span><span class="app"><span class="ic">🟣</span>PhonePe</span><span class="app"><span class="ic">🔴</span>Paytm</span><span class="app">➕ Any UPI app</span>
          </div>
        </div>`
      : ""}
    <div id="status"></div>
    <div id="paybox">
      <button class="paybtn" id="payBtn" onclick="tryPay()">${payLabel}</button>
      <div id="upiBox"></div>
      <div class="note">After paying, return here automatically (or leave this page open) — we confirm your payment on WhatsApp when it's verified. No automatic deduction happens by tapping Continue.</div>
      ${opts.simulator ? `<div style="margin-top:12px"><button class="btn green" style="width:100%" onclick="sim()">Demo: Simulate verified payment</button></div>` : ""}
    </div>
  </div>
</div>
<script>
var BASE=${json(base)};
var order=${json({ id: order.id, total: order.total })};
var UPILINK=${json(opts.upiLink || "")};
var LINK=${json(opts.paymentLink || "")};
var UPI=${json(opts.upiId || "")};
var started=false,startTs=0,paid=false,pendingMsgShown=0;
function done(){
  paid=true;
  document.getElementById("paywrap").innerHTML=
    '<div class="payok"><div class="chk">✅</div><h2>Payment Successful</h2><p>Amount <b>${only(order.total)}</b> received for Order <b>'+esc(order.id)+'</b>.<br>We\\'ve messaged you on WhatsApp to confirm your delivery details 🧡</p></div>';
}
function setStatus(html,cls,id){
  var el=document.getElementById("status");
  if(paid)return;
  if(!id)id=cls;
  el.className=id||"";
  el.innerHTML=html;
}
function tryPay(){
  if(paid)return;
  if(UPILINK){started=true;startTs=Date.now();setStatus("⏳ Opening your UPI app… choose Google Pay, PhonePe, Paytm or another installed UPI app to complete the payment.","okb");document.getElementById("payBtn").disabled=true;location.href=UPILINK;
    setTimeout(function(){document.getElementById("payBtn").disabled=false;},2500);
  } else if(LINK){started=true;startTs=Date.now();window.open(LINK,"_blank","noopener");setStatus("⏳ You\'ll be taken to the payment page. Complete the payment there — we verify it automatically.","okb");}
  else if(UPI){try{navigator.clipboard.writeText(UPI);}catch(e){}setStatus("💳 Pay <b>${only(order.total)}</b> to <b>"+esc(UPI)+"</b> (copied — paste in any UPI app). We\'ll verify the payment automatically once it arrives.","okb");}
  else setStatus("No payment method is configured yet. Please contact ZIPRA on WhatsApp.","errb");
}
function sim(){
  if(paid)return;
  fetch(BASE+"/api/payment/simulate/"+encodeURIComponent(order.id),{method:"POST"}).then(function(r){return r.json();}).then(function(d){if(d.ok)done();else alert(d.error||"Simulator disabled (PAYMENT_SIMULATOR=1).");}).catch(function(){alert("Simulator request failed.");});
}
function checkStatus(){
  fetch(BASE+"/api/store/order/"+encodeURIComponent(order.id)).then(function(r){return r.json();}).then(function(d){
    if(d.order&&d.order.paymentStatus==="Paid"){done();return;}
    if(started){
      var ago=Date.now()-startTs;
      if(ago>4000&&ago<30000&&!pendingMsgShown){pendingMsgShown=Date.now();setStatus("⏳ Payment is being processed… we\'ll confirm on WhatsApp the moment it\'s verified.","okb");}
      else if(ago>=30000){
        if(pendingMsgShown&&Date.now()-pendingMsgShown<20000)return;
        setStatus("⚠️ Payment was <b>not completed</b> (cancelled or yet to be verified). No money has been deducted. Tap below to <b>Try Payment Again</b>.","errb");
        document.getElementById("payBtn").disabled=false;
      }
    }
  }).catch(function(){});
}
setInterval(checkStatus,4000);
document.addEventListener("visibilitychange",function(){
  if(document.visibilityState==="visible"&&started&&!paid)setTimeout(function(){checkStatus();},2200);
});
window.addEventListener("focus",function(){if(started&&!paid)setTimeout(function(){checkStatus();},2200);});
if(!UPILINK&&!LINK&&UPI){
  document.getElementById("upiBox").innerHTML='<div class="upiid" style="margin-top:10px"><span>'+esc(UPI)+'</span><button onclick="navigator.clipboard&&navigator.clipboard.writeText(\\''+esc(UPI)+'\\');this.textContent=\\'Copied\\';">Copy</button></div>';
}
</script>`
  );
}

function reviewPage(base, orderNo) {
  return shell(
    "Review",
    `<style>
.hdr{background:linear-gradient(135deg,#ff7a18 0%,#ff4d00 60%,#e8470a 100%);color:#fff;padding:18px 16px;border-radius:0 0 28px 28px}
.hdr .logo{font-weight:800;font-size:18px;letter-spacing:.5px}
.hdr .logo span{color:#ffd9b8}
main{max-width:520px;margin:0 auto;padding:16px 14px 40px}
</style>
<header class="hdr"><div><div class="logo">ZIPRA<span> Review</span></div></div></header>
<main>
  <h2 style="font-size:17px;margin:4px 0 10px">⭐ How was your order?</h2>
  <div id="errbox" class="errb" style="display:none"></div>
  <div id="done" class="okb" style="display:none">✅ Thank you! Your feedback helps us serve you better.</div>
  <div class="card">
    <p style="font-size:14px;margin:0 0 10px">Tell us how the groceries and delivery were.</p>
    <div id="stars" style="font-size:38px;cursor:pointer;letter-spacing:8px;color:#ffb300">☆☆☆☆☆</div>
    <div class="field"><textarea id="msg" rows="3" placeholder="Anything we should know?"></textarea></div>
    <button class="btn" id="send" style="width:100%">Submit Review</button>
  </div>
</main>
<script>
var BASE=${json(base)};
var order=${json(orderNo)};
var rating=0;
var starsEl=document.getElementById("stars");
starsEl.addEventListener("click",function(e){
 var x=(e.clientX-e.currentTarget.getBoundingClientRect().left)/e.currentTarget.offsetWidth;
 rating=Math.max(1,Math.min(5,Math.ceil(x/0.2)));
 starsEl.textContent="★".repeat(rating)+"☆".repeat(5-rating);
});
document.getElementById("send").addEventListener("click",function(){
 var msg=document.getElementById("msg").value;
 fetch(BASE+"/api/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order:order,rating:rating,message:msg})})
 .then(function(r){return r.json();}).then(function(d){
  if(d.ok){document.getElementById("done").style.display="block";document.getElementById("send").disabled=true;}
 }).catch(function(){document.getElementById("errbox").style.display="block";document.getElementById("errbox").textContent="Couldn't submit. Please try again.";});
});
</script>`
  );
}

function notFoundPage() {
  return shell(
    "Not found",
    `<main>
  <div class="zero"><div class="big">🤔</div><h2>Order not found</h2><p>The order link is invalid or has expired.</p></div>
</main>`
  );
}

module.exports = { shopPage, payPage, reviewPage, notFoundPage };