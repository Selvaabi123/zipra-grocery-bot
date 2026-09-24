module.exports = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ZIPRA Admin</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
:root{
  --br:#FF6B00; --br-2:#ff7b1e; --br-dark:#E65100; --br-deep:#b34000; --br-ink:#c2410c;
  --br-soft:#FFF1E6; --br-line:#ffd7b8;
  --bg:#FFF8F3; --card:#ffffff; --line:#E5E7EB; --line2:#e6e9ee;
  --text:#1F2937; --muted:#6B7280; --faint:#9aa3ad;
  --red:#d92d20; --red-soft:#fef1f0; --amber:#a3540b; --amber-soft:#fdf0e4;
  --blue:#1d4ed8; --blue-soft:#eaf0fe;
  --r:14px;
  --sidebar-w:238px;
  --shadow:0 1px 2px rgba(17,24,39,.05),0 2px 6px rgba(17,24,39,.06);
  --shadow-lg:0 18px 44px rgba(17,24,39,.16);
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;font-size:14px}
button{font-family:inherit}
a{color:inherit;text-decoration:none}
:focus{outline:none}
:focus-visible{outline:2px solid var(--br);outline-offset:2px;border-radius:4px}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:#d4dcd6;border-radius:8px;border:2px solid transparent;background-clip:content-box}

.layout{display:flex;min-height:100vh}
.sidebar{width:var(--sidebar-w);flex:none;background:linear-gradient(180deg,#24282e 0%,#191c20 100%);color:#edf0f4;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
.sb-nav{padding:14px 12px;flex:1}
.nav-block{padding:0;margin:0 0 16px}
.nav-cat{font-size:10.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#8b949e;padding:8px 12px 6px}
.nav-link{display:flex;align-items:center;gap:11px;width:100%;border:0;background:none;color:#aeb6c0;font-size:13.5px;font-weight:500;padding:9px 12px;border-radius:10px;cursor:pointer;margin-bottom:2px;text-align:left;transition:all .12s;position:relative}
.nav-link:hover{background:rgba(255,255,255,.06);color:#fff}
.nav-link.on{background:rgba(255,107,0,.16);color:#ffc292;font-weight:600;box-shadow:inset 2px 0 0 0 var(--br),inset 0 0 0 1px rgba(255,255,255,.06)}
.nav-link.on:hover{color:#ffb56b}
.nav-link .n-ic{display:inline-flex;width:18px;color:#7f8894;flex:none}
.nav-link.on .n-ic{color:var(--br)}
.nav-link .n-bd{display:inline-flex;margin-left:auto;min-width:20px;padding:1px 7px;border-radius:999px;background:rgba(255,255,255,.14);font-size:11px;font-weight:700;justify-content:center}
.nav-link.on .n-bd{background:var(--br-2)}
.sb-foot{padding:13px 18px;border-top:1px solid rgba(255,255,255,.09);font-size:11px;color:#8b949e}

.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{height:62px;background:var(--card);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px;padding:0 24px;position:sticky;top:0;z-index:30}
.gsearch{flex:1;max-width:480px;position:relative}
.gsearch .gi{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--faint);display:flex}
.gsearch input{width:100%;padding:9px 12px 9px 36px;border:1px solid var(--line);border-radius:11px;font-size:13.5px;background:#f7f8f9;outline:none;transition:all .12s}
.gsearch input:focus{background:#fff;border-color:var(--br);box-shadow:0 0 0 3px rgba(255,107,0,.1)}
.tb-right{margin-left:auto;display:flex;align-items:center;gap:10px}
.tb-date{font-size:12.5px;color:var(--muted)}
.tb-btn{width:38px;height:38px;border-radius:11px;border:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;color:#37453e}
.tb-btn:hover{background:#fff6ee}
.tb-btn .dotn{position:absolute;top:8px;right:9px;width:8px;height:8px;border-radius:50%;background:var(--red);border:2px solid #fff}
.prof{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:11px;padding:4px 10px 4px 5px;cursor:pointer;background:#fff}
.prof:hover{background:#fff8f3}
.av{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,var(--br-2),var(--br));color:#fff;font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}
.prof .nm{font-size:13px;font-weight:600}
.dropdown{position:absolute;top:50px;right:0;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow-lg);min-width:250px;z-index:60;display:none;overflow:hidden}
.dropdown.open{display:block}
.dd-head{padding:12px 14px;border-bottom:1px solid var(--line);background:#fff8f3}
.dd-item{display:flex;gap:10px;align-items:flex-start;padding:11px 14px;border-bottom:1px solid #f6efe3;cursor:pointer;font-size:13px}
.dd-item:hover{background:#fff8f3}
.dd-item .d-t{font-weight:600}
.dd-item .d-s{font-size:12px;color:var(--muted);margin-top:1px}
.dd-empty{padding:18px;text-align:center;color:var(--muted);font-size:13px}
.notif-ic{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex:none}
.dd-item.menu:hover{background:#f4f6f5}

.page{padding:26px 28px 64px;max-width:1280px;width:100%;margin:0 auto}
.p-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:20px}
.p-title h1{font-size:22px;font-weight:800;margin:0;letter-spacing:-.3px}
.p-title p{font-size:13px;color:var(--muted);margin:4px 0 0}
.p-actions{display:flex;gap:9px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;color:#26323b;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:all .13s}
.btn:hover{border-color:#c3cbd2;background:#fff8f3}
.btn:disabled{opacity:.5;cursor:wait}
.btn.primary{background:linear-gradient(180deg,#f26d17,#cf4300);border-color:#cf4300;color:#fff}
.btn.primary:hover{background:linear-gradient(180deg,#ff8a33,#b43a0a);box-shadow:0 6px 16px rgba(255,107,0,.34)}
.btn.ghost{color:var(--br-ink);border-color:var(--br-line);background:#fff}
.btn.ghost:hover{background:var(--br-soft)}
.btn.danger{color:var(--red);border-color:#f2b6b2;background:#fff}
.btn.danger:hover{background:var(--red-soft)}
.btn.sm{padding:5px 10px;font-size:12px}
.icn{flex:none}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:17px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow)}
.sic{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none}
.sl{font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted)}
.sv{font-size:24px;font-weight:800;margin-top:3px;letter-spacing:-.3px;font-variant-numeric:tabular-nums}
.ss{font-size:11.5px;color:var(--muted);margin-top:2px}

.panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden}
.chips{display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:16px 16px 14px;border-bottom:1px solid var(--line)}
.chips::-webkit-scrollbar{display:none}
.chip{flex:none;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:600;cursor:pointer;color:var(--muted);transition:all .12s}
.chip:hover{border-color:#c9cfd6;color:var(--text)}
.chip.on{background:linear-gradient(180deg,#f26d17,#d14300);border-color:#d14300;color:#fff;box-shadow:0 2px 10px rgba(255,107,0,.24)}
.chip .cd{font-size:11px;font-weight:700;background:#f3ece1;border-radius:999px;padding:1px 8px;color:var(--muted);font-variant-numeric:tabular-nums}
.chip.on .cd{background:rgba(255,255,255,.24);color:#fff}
.ftool{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;flex-wrap:wrap;border-bottom:1px solid var(--line)}
.ftool .fsearch{position:relative;flex:1;min-width:220px;max-width:340px}
.ftool .fsearch input{width:100%;padding:7px 12px 7px 32px;border:1px solid var(--line);border-radius:10px;font-size:13px;outline:none;background:#fff}
.ftool .fsearch input:focus{border-color:var(--br);box-shadow:0 0 0 3px rgba(255,107,0,.1)}
.ftool select{border:1px solid var(--line);border-radius:10px;padding:7px 10px;font-size:13px;background:#fff;outline:none;cursor:pointer}

.tablewrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:11px 14px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);background:#fff8f3;white-space:nowrap}
td{padding:13px 14px;border-bottom:1px solid #f0f2f1;vertical-align:middle}
tbody tr{transition:background .1s}
tbody tr:hover{background:#fff9f3}
tr:last-child td{border-bottom:none}
.trow{cursor:pointer}
.t-id{font-weight:700;color:var(--br-ink)}
.t-sub{font-size:11.5px;color:var(--muted);margin-top:2px}
.cust{display:flex;align-items:center;gap:9px}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.pill .pd{width:6px;height:6px;border-radius:50%}
.money{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.pimg{width:42px;height:42px;border-radius:11px;overflow:hidden;background:#FFF8F3;display:flex;align-items:center;justify-content:center;flex:none;color:#d28954}
.pimg img{width:100%;height:100%;object-fit:cover;display:block}
.pimg-fb{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#d28954}

.empty{text-align:center;padding:54px 16px;color:var(--muted);font-size:13.5px}
.empty .eic{width:56px;height:56px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;background:var(--br-soft);color:var(--br);margin-bottom:12px}
.empty .et{font-size:15px;font-weight:700;color:var(--text)}
.spinrow{display:flex;justify-content:center;padding:46px}
.spinner{width:34px;height:34px;border:3px solid #f1e4d4;border-top-color:var(--br);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.skel{height:84px;border-radius:var(--r);margin-bottom:12px;background:linear-gradient(90deg,#f4ece1 0%,#fcf8f2 50%,#f4ece1 100%);background-size:800px 100%;animation:shm 1.2s infinite linear}
@keyframes shm{0%{background-position:-400px 0}100%{background-position:400px 0}}

.modal-ov{position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:70;display:none;align-items:flex-start;justify-content:center;padding:70px 16px;overflow-y:auto}
.modal-ov.open{display:flex}
.modal{background:#fff;border-radius:16px;box-shadow:var(--shadow-lg);width:100%;max-width:400px;animation:pop .16s ease}
@keyframes pop{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
.m-head{display:flex;justify-content:space-between;align-items:center;padding:17px 20px;border-bottom:1px solid var(--line)}
.m-head h3{margin:0;font-size:16px;font-weight:800}
.m-x{border:0;background:none;font-size:22px;color:var(--faint);cursor:pointer;line-height:1;padding:4px;border-radius:8px}
.m-x:hover{background:#f6efe3;color:var(--text)}
.m-body{padding:20px}
.m-foot{display:flex;justify-content:flex-end;gap:9px;padding:15px 20px;border-top:1px solid var(--line)}

.drawer-ov{position:fixed;inset:0;background:rgba(17,24,39,.32);z-index:80;opacity:0;pointer-events:none;transition:opacity .22s ease}
.drawer-ov.open{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:540px;max-width:100vw;background:#fff;border-left:1px solid var(--line);border-top-left-radius:18px;border-bottom-left-radius:18px;box-shadow:-18px 0 44px rgba(17,24,39,.16);z-index:81;display:flex;flex-direction:column;transform:translateX(103%);transition:transform .26s cubic-bezier(.3,.9,.3,1)}
.drawer.open{transform:none}
.drawer.wide{width:720px}
.drawer.slim{width:440px}
.d-h{padding:15px 18px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;gap:11px;flex:none}
.d-back,.d-x{border:0;background:none;color:var(--muted);cursor:pointer;width:32px;height:32px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.d-back:hover{background:var(--br-soft);color:var(--br-dark)}
.d-x:hover{background:#f4ece1;color:var(--text)}
.d-ic{width:34px;height:34px;border-radius:10px;background:var(--br-soft);color:var(--br);display:inline-flex;align-items:center;justify-content:center;flex:none}
.d-ttl{font-size:15px;font-weight:800;display:flex;align-items:center;gap:9px}
.d-sub{font-size:12px;color:var(--muted);margin-top:3px;font-weight:400}
.d-body{flex:1;overflow-y:auto;padding:18px}
.d-foot{padding:14px 18px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:9px;background:#fff;flex:none}
.d-foot .btn{min-width:104px;justify-content:center}
.d-sec{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin:22px 0 13px}
.d-sec:first-child{margin-top:0}
.d-sec .s-ic{color:var(--br);display:inline-flex}
.d-sec:after{content:"";flex:1;height:1px;background:var(--line)}
.d-preview{margin-top:13px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
.d-preview .pv-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:var(--muted)}
.d-preview .pv-row b{color:var(--text)}
.d-preview .pv-row.pv-new{border-top:1px dashed var(--line);margin-top:5px;padding-top:8px;color:var(--text);font-weight:700}
.d-preview .pv-new .pv-v{color:var(--br-dark)}
.d-card{border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;gap:11px;align-items:center;cursor:pointer;transition:all .12s}
.d-card:hover{border-color:var(--br);box-shadow:var(--shadow)}
.d-card+.d-card{margin-top:9px}
.f-group{margin-bottom:14px}
.f-group label{display:block;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.f-group input,.f-group select,.f-group textarea{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:10px;font-size:13.5px;outline:none;background:#fff;font-family:inherit}
.f-group input:focus,.f-group select:focus,.f-group textarea:focus{border-color:var(--br);box-shadow:0 0 0 3px rgba(255,107,0,.08)}
.f-row{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.f-row3{display:grid;grid-template-columns:2fr 1fr 1fr;gap:11px}

.toast{position:fixed;bottom:24px;right:24px;background:#111a16;color:#fff;font-size:13px;font-weight:500;padding:12px 18px;border-radius:12px;opacity:0;transform:translateY(8px);transition:all .18s;pointer-events:none;z-index:90;max-width:84vw;box-shadow:0 10px 28px rgba(0,0,0,.3);display:flex;align-items:center;gap:9px}
.toast.show{opacity:1;transform:none}
.toast.err{background:#b42318}

.detail-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.backl{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:13.5px;font-weight:600;cursor:pointer;border:0;background:none;padding:6px 8px;border-radius:8px}
.backl:hover{background:#f4ece1;color:var(--text)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid2 .full{grid-column:1/-1}
.cbox{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow);padding:18px}
.cbox h4{margin:0 0 14px;font-size:12px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:8px}
.kv{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px dashed #f0f2f1;font-size:13px}
.kv:last-child{border-bottom:none}
.kv .k{color:var(--muted)}
.kv .v{font-weight:600;text-align:right;word-break:break-word}

.timeline{margin-top:6px}
.tl{display:flex;gap:13px;position:relative;padding-bottom:18px}
.tl:last-child{padding-bottom:0}
.tl .rail{width:22px;display:flex;flex-direction:column;align-items:center;flex:none}
.tl .dot{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;background:#f3ece1;color:#a99d8f;flex:none}
.tl .ln{width:2px;flex:1;background:#f0e6d8;margin-top:4px}
.tl.done .dot{background:var(--br-2);color:#fff}
.tl.cur .dot{background:var(--br);color:#fff;box-shadow:0 0 0 4px rgba(255,107,0,.18)}
.tl.cur .ln{background:var(--br)}
.tl .t-body{padding-top:1px}
.tl .t-label{font-size:13px;font-weight:600}
.tl .t-sub{font-size:11.5px;color:var(--muted);margin-top:2px}
.tl.cur .t-label{color:var(--br-ink);font-weight:800}
.tl.next .t-label{color:var(--faint)}

.ibox{min-height:180px;border:1px dashed var(--line2);border-radius:12px;padding:14px;margin-top:4px;font-size:14px}
.ibox .ib-sel{display:flex;gap:8px;margin-bottom:10px}
.ibox select,.ibox input{width:auto;min-width:0}

.bar-chart{display:flex;align-items:flex-end;gap:10px;height:180px;padding:10px 4px 0}
.bc{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:7px;height:100%}
.bc .bar{width:70%;max-width:34px;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#ff8a3c,var(--br));min-height:4px;transition:height .3s}
.bc .b-l{font-size:10.5px;color:var(--muted);white-space:nowrap}
.bc .b-v{font-size:10.5px;font-weight:700;color:var(--text)}
.topl{display:flex;flex-direction:column;gap:9px}
.tlp{display:flex;align-items:center;gap:11px;font-size:13px}
.tlp .rank{width:24px;height:24px;border-radius:8px;background:var(--br-soft);color:var(--br);font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;flex:none}
.tlp .barn{flex:1;background:#f4ece1;border-radius:6px;height:9px;overflow:hidden}
.tlp .barn i{display:block;height:100%;background:linear-gradient(90deg,var(--br-2),#ff8a3c);border-radius:6px}
.tlp .qty{font-weight:700;font-variant-numeric:tabular-nums;min-width:80px;text-align:right}
.switch{position:relative;width:40px;height:22px;border-radius:999px;background:#dfe4e1;cursor:pointer;border:0;transition:background .15s}
.switch.on{background:var(--br-2)}
.switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.switch.on::after{left:21px}
.linkbtn{border:0;background:none;color:var(--br-ink);font-weight:600;font-size:12.5px;cursor:pointer;padding:3px 6px;border-radius:6px}
.linkbtn:hover{background:var(--br-soft);color:var(--br-dark)}
.linkbtn.red{color:var(--red)}
.linkbtn.red:hover{background:var(--red-soft)}
.kpi-mini{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.h-intro{color:var(--muted);font-size:12.5px}
.dash-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.list-plain{list-style:none;margin:0;padding:0}
.list-plain li{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid #f0f2f1;font-size:13px}
.list-plain li:last-child{border-bottom:none}
@media(max-width:980px){
  .sidebar{width:64px}
  .sb-brand .t,.sb-brand .s,.nav-link .nt,.sb-foot,.nav-cat{display:none}
  .nav-link{justify-content:center;padding:11px 0}
  .nav-block{margin-bottom:4px}
  .nav-link .n-bd{position:absolute;margin-top:-24px;margin-left:26px}
  .nav-link{position:relative}
  .stats{grid-template-columns:repeat(2,1fr)}
  .grid2{grid-template-columns:1fr}
}
@media(max-width:680px){
  .sidebar{width:58px}
  .topbar{padding:0 12px}
  .tb-date{display:none}
  .stats{grid-template-columns:1fr 1fr;gap:10px}
  .page{padding:18px 12px 64px}
  .p-actions{width:100%}
  .p-actions .btn{flex:1;justify-content:center}
  .ftool{flex-direction:column;align-items:stretch}
  .ftool .fsearch{max-width:none}
  .kpi-mini{grid-template-columns:repeat(2,1fr)}
  .drawer,.drawer.wide,.drawer.slim{width:100%;border-top-left-radius:15px;border-bottom-left-radius:15px}
  .drawer .grid2{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
}
@media print{
  body *{visibility:hidden}
  #printArea,#printArea *{visibility:visible}
  #printArea{position:absolute;left:0;top:0;width:100%}
  #printArea{box-shadow:none}
}
</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar">
<div class="sb-brand" style="padding:20px 16px 14px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:11px">
        <div style="width:40px;height:40px;border-radius:13px;background:linear-gradient(135deg,#ff7b1e,#E65100);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(255,107,0,.35);font-weight:900;font-size:18px;color:#fff;flex:none">Z</div>
        <div class="sb-btxt" style="min-width:0">
          <div class="t" style="font-size:15px;font-weight:800;letter-spacing:.4px;color:#fff;line-height:1.1">ZIPRA</div>
          <div class="s" style="font-size:10px;color:#8b949e;letter-spacing:1.4px;text-transform:uppercase;margin-top:3px">Admin</div>
        </div>
      </div>
    <nav class="sb-nav" id="nav">
      <div class="nav-cat">Overview</div>
      <button class="nav-link" data-nav="dashboard"><i class="n-ic"></i><span class="nt">Dashboard</span></button>
      <div class="nav-cat" style="margin-top:14px">Operations</div>
      <button class="nav-link" data-nav="orders"><i class="n-ic"></i><span class="nt">Orders</span><span class="n-bd" id="navBadgeOrders" style="display:none">0</span></button>
      <button class="nav-link" data-nav="products"><i class="n-ic"></i><span class="nt">Products</span></button>
      <button class="nav-link" data-nav="inventory"><i class="n-ic"></i><span class="nt">Inventory</span></button>
      <button class="nav-link" data-nav="customers"><i class="n-ic"></i><span class="nt">Customers</span></button>
      <button class="nav-link" data-nav="partners"><i class="n-ic"></i><span class="nt">Delivery Partners</span></button>
      <div class="nav-cat" style="margin-top:14px">Insights</div>
      <button class="nav-link" data-nav="reports"><i class="n-ic"></i><span class="nt">Reports</span></button>
      <button class="nav-link" data-nav="promotions"><i class="n-ic"></i><span class="nt">Promotions</span></button>
      <button class="nav-link" data-nav="settings"><i class="n-ic"></i><span class="nt">Settings</span></button>
    </nav>
    <div class="sb-foot">Fresh Groceries. Faster Deliveries.</div>
  </aside>
  <div class="main">
    <div class="topbar">
      <div class="gsearch">
        <span class="gi"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></span>
        <input id="gq" placeholder="Search orders, products, customers..." autocomplete="off"/>
      </div>
      <div style="position:relative">
        <button class="tb-btn" id="notifBtn" title="Notifications">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="dotn" id="notifDot" style="display:none"></span>
        </button>
        <div class="dropdown" id="notifDrop"></div>
      </div>
      <div style="position:relative">
        <button class="prof" id="profBtn">
          <span class="av" id="profAv" style="width:30px;height:30px">A</span>
          <span class="nm">Admin</span>
          <svg style="color:var(--muted)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="dropdown" id="profDrop">
          <div class="dd-head"><b>Admin</b><div style="font-size:12px;color:var(--muted)">ZIPRA Grocery</div></div>
          <div class="dd-item menu" data-go="settings">Settings</div>
          <div class="dd-item menu" id="logoutBtn" style="color:var(--red)">Sign out</div>
        </div>
      </div>
    </div>
    <div class="page" id="page"></div>
  </div>
</div>
<div class="modal-ov" id="modalOv"><div class="modal" id="modalBox"></div></div>
<div class="drawer-ov" id="drawerOv"></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Detail panel">
  <div class="d-h" id="dHead"></div>
  <div class="d-body" id="dBody"></div>
  <div class="d-foot" id="dFoot"></div>
</aside>
<div class="toast" id="toast"></div>

<script>
var IC={
logo:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h8v8H3z"/><path d="M13 3h8v5h-8z"/><path d="M13 12h8v9h-8z"/><path d="M3 15h8v6H3z"/></svg>',
dashboard:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/></svg>',
orders:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
products:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/></svg>',
inventory:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><path d="M6 18h12"/><path d="M6 14h12"/><path d="M6 10h12"/></svg>',
customers:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
partners:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
reports:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>',
promotions:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/></svg>',
settings:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
refresh:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
plus:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
arrow:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>',
back:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',
search:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
box:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>',
pin:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
card:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>',
wallet:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/></svg>',
edit:'<svg class="icn" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
trash:'<svg class="icn" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
phone:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
wa:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.94L2 22l5.17-1.49A9.94 9.94 0 1 0 12.04 2zm5.87 14.14c-.25.7-1.45 1.34-2 1.38-.51.04-1.16.07-1.87-.12a16 16 0 0 1-1.78-.65c-3.13-1.35-5.17-4.5-5.33-4.71-.15-.21-1.27-1.69-1.27-3.22 0-1.53.8-2.28 1.08-2.6.28-.31.61-.39.81-.39.2 0 .4 0 .58.01.19.01.44-.07.68.52.25.6.85 2.08.92 2.23.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.18-.31.4-.45.54-.15.14-.3.3-.13.59.17.28.76 1.25 1.63 2.03 1.12 1 2.07 1.31 2.36 1.46.29.15.46.12.63-.07.17-.2.73-.85.92-1.14.2-.29.39-.24.66-.15.27.1 1.72.81 2.01.96.3.15.5.22.57.34.07.12.07.7-.17 1.4z"/></svg>',
print:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
clipboard:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
delivery:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
alert:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
check:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
clock:'<svg class="icn" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
rupee:'<svg class="icn" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12"/><path d="M6 8h12"/><path d="M6 13l8.5 8"/><path d="M6 13h3a6 6 0 0 0 0-12"/></svg>',
x:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>'};
(function(){document.querySelectorAll('#nav .nav-link').forEach(function(b){var i=b.querySelector('.n-ic');if(i)i.innerHTML=IC[b.getAttribute('data-nav')]||'';});})();
var COLORS={received:{bg:'#eef1f5',fg:'#525b66',dot:'#7c8794'},confirmed:{bg:'#FFF1E6',fg:'#c2410c',dot:'#FF6B00'},preparing:{bg:'#fff7ea',fg:'#a16207',dot:'#f59e0b'},out_for_delivery:{bg:'#eaf3fb',fg:'#1e56b3',dot:'#3b82f6'},delivered:{bg:'#eef2f5',fg:'#344054',dot:'#475467'},cancelled:{bg:'#fef1f0',fg:'#b42318',dot:'#d92d20'}};
var LABEL={received:'Received',confirmed:'Confirmed',preparing:'Preparing',out_for_delivery:'Out for Delivery',delivered:'Delivered',cancelled:'Cancelled'};
var ORDERS=['received','confirmed','preparing','out_for_delivery','delivered','cancelled'];
var NEXT={'received':'confirmed','confirmed':'preparing','preparing':'out_for_delivery','out_for_delivery':'delivered'};

function esc(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function money(n){var v=Number(n||0);return '₹'+Math.round(v).toLocaleString('en-IN');}
function num(n,d){var x=parseFloat(n);return isNaN(x)?(d==null?0:d):x;}
function pill(st){var c=COLORS[st]||COLORS.received;return '<span class="pill" style="background:'+c.bg+';color:'+c.fg+'"><span class="pd" style="background:'+c.dot+'"></span>'+LABEL[st]+'</span>';}
function payBadge(p){return String(p||'').toLowerCase()==='paid'?'<span class="pill" style="background:var(--br-soft);color:var(--br-ink)">Paid</span>':'<span class="pill" style="background:#fdf0e4;color:#b54708">'+esc(p||'Pending')+'</span>';}
function fmtTS(ts){if(!ts)return '—';var d=new Date(ts);if(isNaN(d.getTime()))return '—';var mth=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];var h=d.getHours(),mi=d.getMinutes();var ap=h>=12?'PM':'AM';h=h%12||12;return d.getDate()+' '+mth[d.getMonth()]+' '+d.getFullYear()+', '+h+':'+String(mi).padStart(2,'0')+' '+ap;}
function fmtDateD(ts){if(!ts)return '—';var d=new Date(ts);if(isNaN(d.getTime()))return '—';return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}
function initials(n){n=String(n||'A').trim();var p=n.split(' ').filter(Boolean);return esc(((p[0]||'A')[0]||'A').toUpperCase()+((p[1]||'')[0]||'').toUpperCase());}
function safeAddr(o){var a=String(o.address||'').trim();if(!a)return 'Delivery location received';var m=a.match(/-?\\d+(\\.\\d+)?\\s*,\\s*-?\\d+(\\.\\d+)?/);return m?a.replace(m[0],'Delivery location received').replace(/^[📍]+/,'').trim():a;}
function openMaps(o){if(o.lat&&o.lng)return '<a class="linkbtn" target="_blank" rel="noopener" href="https://maps.google.com/maps?q='+o.lat+','+o.lng+'">'+IC.pin+' Open in Maps</a>';return '';}
function setNavBadge(n){var el=document.getElementById('navBadgeOrders');if(!el)return;n=Number(n||0);el.style.display=n>0?'inline-flex':'none';el.textContent=n;}
function __imgErr(img){if(!img)return;var c=img.parentNode;if(!c)return;img.style.display='none';var fb=c.querySelector('.pimg-fb');if(fb)fb.style.display='flex';}
function pImg(p){
  var fb='<span class="pimg-fb">'+IC.box+'</span>';
  if(!p.image)return '<span class="pimg">'+IC.box+'</span>';
  return '<span class="pimg"><img src="'+esc(p.image)+'" alt="" loading="lazy" onerror="__imgErr(this)">'+fb+'</span>';
}

var token=localStorage.getItem('zipra_token')||'';
var state={view:'dashboard',arg:null,orders:[],stats:null,statusCounts:{},order:null,products:[],categories:[],inventory:[],cust:[],partners:[],promotions:[],settings:{},filters:{status:'all',q:''},prodQ:'',prodCat:'',notifOpen:false,profOpen:false};
var POLL=null;

function api(path,opts){
  opts=opts||{};
  var headers=opts.headers||{};
  if(token)headers['Authorization']='Bearer '+token;
  if(opts.body!==undefined&&opts.body!==null)headers['Content-Type']='application/json';
  return fetch(path,{method:opts.method||'GET',headers:headers,body:opts.body!==undefined?JSON.stringify(opts.body):undefined}).then(function(r){
    if(r.status===401){closeModal();toast('Enter admin token to continue','err');setTimeout(function(){var t=prompt('Admin token:');if(t){token=t;localStorage.setItem('zipra_token',t);route();}},150);return Promise.reject(new Error('unauthorized'));}
    return r.json().catch(function(){return {};}).then(function(j){
      if(!r.ok)return Promise.reject(new Error((j&&j.error)||('Request failed ('+r.status+')')));
      return j;
    });
  });
}

function toast(msg,type){
  var t=document.getElementById('toast');
  t.textContent=msg;t.className='toast show'+(type==='err'?' err':'');
  clearTimeout(t._h);t._h=setTimeout(function(){t.className='toast';},2600);
}
var vertigo=null;
function conf(msg){
  return new Promise(function(res){
    vertigo=res;
    openModal(
      '<div style="font-size:14px;line-height:1.5;color:var(--muted)">'+esc(msg)+'</div>',
      [{id:'c-no',title:'Cancel',cls:''},{id:'c-yes',title:'Yes, continue',cls:'primary'}],
      function(id){if(id==='c-yes'&&vertigo)vertigo(true);else if(vertigo)vertigo(false);vertigo=null;},
      'Confirm'
    );
  });
}
function openModal(inner,fbuttons,cb,title){
  var box=document.getElementById('modalBox');
  var btns=(fbuttons||[]).map(function(b){return '<button class="btn '+(b.cls||'')+'" data-mb="'+b.id+'">'+b.title+'</button>';}).join('');
  box.innerHTML='<div class="m-head"><h3>'+esc(title||'')+'</h3><button class="m-x" data-mb="x" aria-label="Close">×</button></div><div class="m-body">'+inner+'</div>'+(btns?'<div class="m-foot">'+btns+'</div>':'');
  document.getElementById('modalOv').classList.add('open');
  box._cb=cb;
  bindModalBtns();
}
function closeModal(){document.getElementById('modalOv').classList.remove('open');}
function bindModalBtns(){
  document.querySelectorAll('#modalBox [data-mb]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-mb');
      if(id==='x'){closeModal();return;}
      var box=document.getElementById('modalBox');
      if(box._cb)box._cb(id);
      closeModal();
    };
  });
}

/* ------------------------------ drawer ------------------------------ */

var _dstack=[];
var _dnested=0;
function openDrawer(cfg){
  var d=document.getElementById('drawer');
  var open=d.classList.contains('open');
  if(open&&_dnested<4){
    _dstack.push({
      head:document.getElementById('dHead').innerHTML,
      body:document.getElementById('dBody').innerHTML,
      foot:document.getElementById('dFoot').innerHTML,
      cb:d._cb
    });
  }
  _dnested=open?_dnested+1:0;
  var ic=cfg.icon||'';
  document.getElementById('dHead').innerHTML=
    '<button class="d-back" title="Back" aria-label="Back">'+IC.arrow+'</button>'+
    (ic?'<span class="d-ic">'+ic+'</span>':'')+
    '<div style="flex:1;min-width:0;padding:3px 0 0"><div class="d-ttl">'+cfg.title+'</div>'+(cfg.sub?'<div class="d-sub">'+cfg.sub+'</div>':'')+'</div>'+
    '<button class="d-x" title="Close" aria-label="Close">'+IC.x+'</button>';
  document.getElementById('dBody').innerHTML=cfg.body||'';
  document.getElementById('dFoot').innerHTML=cfg.foot||'';
  d._cb=cfg.cb||null;
  document.getElementById('dHead').querySelector('.d-back').onclick=closeDrawer;
  document.getElementById('dHead').querySelector('.d-x').onclick=closeDrawer;
  document.getElementById('drawerOv').onclick=function(){closeDrawer();};
  d.className='drawer'+(cfg.wide?' wide':'')+(cfg.slim?' slim':'');
  bindDrawerBtns();
  bindDelegates();
  requestAnimationFrame(function(){
    document.getElementById('drawerOv').classList.add('open');
    d.classList.add('open');
  });
  if(cfg.onopen)cfg.onopen();
}
function closeDrawer(){
  var d=document.getElementById('drawer');
  if(_dstack.length){
    var prev=_dstack.pop();
    _dnested--;
    document.getElementById('dHead').innerHTML=prev.head;
    document.getElementById('dBody').innerHTML=prev.body;
    document.getElementById('dFoot').innerHTML=prev.foot;
    d._cb=prev.cb;
    bindDrawerBtns();
    return;
  }
  _dnested=0;
  document.getElementById('drawerOv').classList.remove('open');
  d.classList.remove('open');
}
function clearDstack(){_dstack.length=0;_dnested=0;}
function bindDrawerBtns(){
  document.querySelectorAll('#drawer [data-mb]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-mb');
      var d=document.getElementById('drawer');
      if(id==='x'){closeDrawer();return;}
      if(d._cb)d._cb(id);
    };
  });
}
function afterOrderChange(){
  clearDstack();
  closeDrawer();
  if(state._drw==='order'){openOrderDrawer(state._drwArg);}
  else if(state._drw==='customer'){openCustomerDrawer(state._drwArg);}
  else if(state.view==='orders'&&state.arg)vOrderDetail();
  else route();
}
function connectWa(phone){
  return 'https://wa.me/'+esc(String(phone||'').replace(/^\\+/,''));
}

function go(h){location.hash=h;}

function route(){
  state._drw=null;state._drwArg=null;
  closeDrawer();
  var h=location.hash.replace(/^#\\/?/,'');
  var parts=h.split('/').filter(function(p){return p.length;});
  var view=parts[0]||'dashboard';
  state.view=view;
  state.arg=parts[1]||null;
  document.querySelectorAll('.nav-link').forEach(function(el){
    el.classList.toggle('on',el.getAttribute('data-nav')===view);
  });
  var page=document.getElementById('page');
  page.innerHTML='<div class="spinrow"><div class="spinner"></div></div>';
  if(view==='dashboard'){vDashboard();}
  else if(view==='orders'&&state.arg){vOrderDetail();}
  else if(view==='orders'){vOrders();}
  else if(view==='products'){vProducts();}
  else if(view==='inventory'){vInventory();}
  else if(view==='customers'&&state.arg){vCustomer();}
  else if(view==='customers'){vCustomers();}
  else if(view==='partners'){vPartners();}
  else if(view==='reports'){vReports();}
  else if(view==='promotions'){vPromotions();}
  else if(view==='settings'){vSettings();}
  else go('#/dashboard');
}

/* ------------------------------ dashboard ------------------------------ */

function vDashboard(){
  if(POLL){clearInterval(POLL);POLL=null;}
  Promise.all([
    api('/api/orders?limit=12'),
    api('/api/reports'),
    api('/api/inventory'),
    api('/api/products'),
    api('/api/customers'),
    api('/api/delivery-partners')
  ]).then(function(res){
    var page=document.getElementById('page');
    state.orders=res[0].orders||[];
    state.stats=res[0].stats;
    state.statusCounts=res[0].statusCounts||{};
    var rep=res[1].reports||{};
    var inv=res[2].inventory||[];
    var prods=res[3].products||[];
    var custs=res[4].customers||[];
    var parts=res[5].partners||[];
    var lowStock=inv.filter(function(i){return i.status==='out'||i.status==='low';});
    var alerts=lowStock.slice(0,8);
    setNavBadge((state.statusCounts.received||0)+(state.statusCounts.confirmed||0)+(state.statusCounts.preparing||0));
    var st=state.stats||{total:0,active:0,delivered:0,cancelled:0,revenue:0};
    var recent=state.orders.slice(0,7);
    var recRows=recent.map(function(o){
      return '<tr class="trow" data-go="#/orders/'+esc(o.id)+'" data-drawer="order">'+
        '<td class="t-id">'+esc(o.id)+'</td>'+
        '<td>'+esc(o.name||'—')+'</td>'+
        '<td class="t-sub">'+fmtDateD(o.createdAt)+'</td>'+
        '<td style="text-align:right" class="money">'+money(o.total)+'</td>'+
        '<td>'+pill(o.status)+'</td></tr>';
    }).join('');
    var sc=state.statusCounts||{};
    var statusRows=ORDERS.map(function(k){
      if(!sc[k])return '';
      return '<div class="tlp"><span style="flex:1">'+pill(k)+'</span><span class="qty">'+sc[k]+'</span></div>';
    }).join('');
    var alertRows=alerts.map(function(i){
      return '<li><span class="pimg" style="width:34px;height:34px">'+IC.box+'</span><span style="flex:1;min-width:0"><b>'+esc(i.name)+'</b><div class="t-sub">'+esc(i.category)+'</div></span><span class="pill" style="background:'+(i.status==='out'?'var(--red-soft);color:var(--red)':'var(--amber-soft);color:var(--amber)')+'">'+esc(i.stock)+' '+esc(i.unit)+'</span></li>';
    }).join('');
    page.innerHTML=
      '<div class="p-head"><div class="p-title"><h1>Dashboard</h1><p class="h-intro">Welcome back, Admin &middot; here&apos;s how ZIPRA is doing today.</p></div>'+
      '<div class="p-actions"><button class="btn" data-act="refresh" data-arg="dashboard">'+IC.refresh+'&nbsp;Refresh<span class="tb-date" style="margin-left:2px">'+fmtTS(new Date().toISOString())+'</span></button>'+
      '<button class="btn primary" data-act="add-order">'+IC.plus+'&nbsp;Add Order</button></div></div>'+
      '<div class="stats">'+
        '<div class="stat"><div class="sic" style="background:var(--br-soft);color:var(--br)">'+IC.orders+'</div><div><div class="sl">Total Orders</div><div class="sv">'+st.total+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:var(--blue-soft);color:var(--blue)">'+IC.delivery+'</div><div><div class="sl">Active Orders</div><div class="sv">'+st.active+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:#eef2f5;color:#344054">'+IC.check+'</div><div><div class="sl">Delivered</div><div class="sv">'+st.delivered+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:var(--amber-soft);color:var(--amber)">'+IC.rupee+'</div><div><div class="sl">Revenue</div><div class="sv">'+money(st.revenue)+'</div></div></div>'+
      '</div>'+
      '<div class="kpi-mini" style="margin:0 0 20px">'+
        '<div class="stat"><div class="sic" style="background:var(--br-soft);color:var(--br)">'+IC.products+'</div><div><div class="sl">Total Products</div><div class="sv">'+prods.length+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:var(--amber-soft);color:var(--amber)">'+IC.alert+'</div><div><div class="sl">Low / Out of Stock</div><div class="sv">'+lowStock.length+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:#e8f1ff;color:var(--blue)">'+IC.customers+'</div><div><div class="sl">Customers</div><div class="sv">'+custs.length+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:var(--br-soft);color:var(--br)">'+IC.delivery+'</div><div><div class="sl">Delivery Partners</div><div class="sv">'+parts.length+'</div></div></div>'+
      '</div>'+
      '<div class="grid2">'+
        '<div class="cbox" style="padding:0"><div style="padding:16px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between"><h4 style="margin:0">'+IC.orders+' Recent Orders</h4><a class="linkbtn" data-go="#/orders">View all</a></div>'+
          (recent.length?'<div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th style="text-align:right">Total</th><th>Status</th></tr></thead><tbody>'+recRows+'</tbody></table></div>':'<div class="empty"><div class="eic">'+IC.box+'</div><div class="et">No orders yet</div><div>Orders placed on WhatsApp will appear here.</div></div>')+
        '</div>'+
        '<div>'+
          '<div class="cbox"><h4>'+IC.orders+' Orders by Status</h4>'+(statusRows||'<div class="t-sub">No orders yet.</div>')+'</div>'+
          '<div class="cbox" style="margin-top:14px"><h4>'+IC.alert+' Inventory Alerts</h4>'+(alertRows?'<ul class="list-plain">'+alertRows+'</ul>':'<div class="t-sub">All stock levels are healthy.</div>')+'</div>'+
        '</div>'+
      '</div>';
    bindDelegates();
  }).catch(function(){page.innerHTML='<div class="empty">Could not load dashboard</div>';});
}

/* ------------------------------ orders ------------------------------ */

function ordersURL(){
  var s=state.filters;
  var qs='status='+encodeURIComponent(s.status)+'&q='+encodeURIComponent(s.q);
  return '/api/orders?'+qs;
}
function vOrders(){
  if(POLL&&state.view!=='orders'){clearInterval(POLL);POLL=null;}
  if(!POLL){POLL=setInterval(function(){loadOrders();},15000);}
  loadOrders();
}
function loadOrders(){
  api(ordersURL()).then(function(d){
    state.orders=d.orders||[];
    state.stats=d.stats;
    state.statusCounts=d.statusCounts||{};
    if(state.view==='dashboard'){vDashboard();return;}
    renderOrders();
  }).catch(function(){});
}
function renderOrders(){
  var page=document.getElementById('page');
  var st=state.stats||{total:0,active:0,delivered:0,cancelled:0,revenue:0};
  var statc=state.statusCounts||{};
  var counts={'all':st.total||0};
  ORDERS.forEach(function(k){counts[k]=statc[k]||0;});
  setNavBadge((statc.received||0)+(statc.confirmed||0)+(statc.preparing||0));
  var chips='<div class="chips"><div style="display:flex;gap:8px;flex-wrap:wrap;margin:auto">';
  var chipKeys=['all'].concat(ORDERS);
  chipKeys.forEach(function(k){
    var label=k==='all'?'All':(LABEL[k]||k);
    chips+='<button class="chip'+(state.filters.status===k?' on':'')+'" data-ch="'+k+'">'+label+'<span class="cd">'+(counts[k]||0)+'</span></button>';
  });
  chips+='</div></div>';
  var stats='<div class="stats">'+
    '<div class="stat"><div class="sic" style="background:var(--br-soft);color:var(--br)">'+IC.orders+'</div><div><div class="sl">Total Orders</div><div class="sv">'+st.total+'</div></div></div>'+
    '<div class="stat"><div class="sic" style="background:var(--blue-soft);color:var(--blue)">'+IC.delivery+'</div><div><div class="sl">Active Orders</div><div class="sv">'+st.active+'</div></div></div>'+
    '<div class="stat"><div class="sic" style="background:#eef2f5;color:#344054">'+IC.check+'</div><div><div class="sl">Delivered</div><div class="sv">'+st.delivered+'</div></div></div>'+
    '<div class="stat"><div class="sic" style="background:var(--amber-soft);color:var(--amber)">'+IC.rupee+'</div><div><div class="sl">Revenue</div><div class="sv">'+money(st.revenue)+'</div></div></div>'+
    '</div>';
  var rows='';
  if(!state.orders.length){
    rows='<div class="empty"><div class="eic">'+IC.box+'</div><div class="et">No orders found</div><div>Try a different filter or search.</div></div>';
  }else{
    rows='<div class="tablewrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Date &amp; Time</th><th>Items</th><th style="text-align:right">Total</th><th>Payment</th><th>Payment Status</th><th>Order Status</th></tr></thead><tbody>'+
      state.orders.map(function(o){
        var items=(o.items||[]).slice(0,3).map(function(it){return esc(it.item)+' × '+it.qty;}).join(', ');
        var more=(o.items||[]).length>3?' +'+(o.items.length-3)+' more':'';
        var itemsCell=items+(more?esc(more):'')||'—';
        var pm=o.paymentMethod==='online'?'Online':'COD';
return '<tr class="trow" data-go="#/orders/'+esc(o.id)+'" data-drawer="order">'+
          '<td><div class="t-id">'+esc(o.id)+'</div><div class="t-sub">'+esc(o.partnerName||'Unassigned')+'</div></td>'+
          '<td><div class="cust"><span class="av" style="width:27px;height:27px;font-size:11px">'+initials(o.name)+'</span><span>'+esc(o.name||'—')+'</span></div></td>'+
          '<td class="t-sub" style="font-variant-numeric:tabular-nums">'+esc(o.waId||'—')+'</td>'+
          '<td class="t-sub">'+fmtTS(o.createdAt)+'</td>'+
          '<td>'+itemsCell+'</td>'+
          '<td style="text-align:right" class="money">'+money(o.total)+'</td>'+
          '<td class="t-sub">'+pm+'</td>'+
          '<td>'+payBadge(o.paymentStatus)+'</td>'+
          '<td>'+pill(o.status)+'</td>'+
        '</tr>';
      }).join('')+
      '</tbody></table></div>';
  }
  page.innerHTML=
    '<div class="p-head"><div class="p-title"><h1>Order Management</h1><p>Manage customer orders, status and delivery.</p></div>'+
    '<div class="p-actions">'+
      '<button class="btn" data-act="refresh" data-arg="orders"><span id="rficn">'+IC.refresh+'</span>&nbsp;Refresh</button>'+
      '<button class="btn primary" data-act="add-order">'+IC.plus+'&nbsp;Add Order</button>'+
    '</div></div>'+
    stats+
    '<div class="panel">'+chips+'</div>'+
    '<div class="panel" style="margin-top:14px">'+rows+'</div>';
  bindDelegates();
}

/* --------------------------- order detail --------------------------- */

function vOrderDetail(){
  api('/api/orders/'+state.arg).then(function(d){
    state.order=d.order;
    renderOrderDetail();
  }).catch(function(){var page=document.getElementById('page');page.innerHTML='<div class="empty">Order not found <button class="btn" data-go="#/orders">Back</button></div>';});
}
function orderDetailBoxes(o){
  var c=COLORS[o.status]||COLORS.received;
  var tl=statusTimeline(o.status,o.history||[]);
  var items=(o.items||[]).map(function(it){
    return '<tr><td>'+esc(it.item)+'<div class="t-sub">'+esc(it.unit||'')+'</div></td><td style="text-align:center">'+it.qty+'</td><td style="text-align:right">'+money(it.price)+'</td><td style="text-align:right" class="money">'+money(it.subtotal)+'</td></tr>';
  }).join('');
  var nextBtn='';
  if(NEXT[o.status]){
    nextBtn='<button class="btn primary" data-act="next" data-arg="'+esc(o.id)+'" data-st="'+NEXT[o.status]+'">'+IC.arrow+'&nbsp;Update Status</button>';
  }
  var paidBtn=o.paymentStatus!=='Paid'?'<button class="btn ghost" data-act="pay" data-arg="'+esc(o.id)+'">'+IC.card+'&nbsp;Mark Paid</button>':'';
  var waBtn='<a class="btn" href="'+connectWa(o.waId)+'" target="_blank" rel="noopener">'+IC.wa+'&nbsp;Message Customer</a>';
  return '<div class="grid2">'+
      '<div>'+
        '<div class="cbox"><h4>'+IC.customers+' Customer Details</h4>'+
          '<div style="display:flex;gap:11px;align-items:center;margin-bottom:10px"><span class="av" style="width:40px;height:40px;font-size:14px">'+initials(o.name)+'</span><div><b>'+esc(o.name||'—')+'</b><div class="t-sub">'+esc(((o.customer&&o.customer.email)||'No email'))+'</div></div></div>'+
          '<div class="kv"><span class="k">Phone</span><span class="v">'+esc(o.waId||'—')+'</span></div>'+
          '<div class="kv"><span class="k">Customer ID</span><span class="v">#'+esc(o.customer_id||'—')+'</span></div>'+
        '</div>'+
        '<div class="cbox" style="margin-top:14px"><h4>'+IC.pin+' Delivery Address</h4>'+
          '<div style="font-size:13.5px;line-height:1.5">'+esc(safeAddr(o))+'</div>'+
          '<div style="margin-top:8px">'+openMaps(o)+'</div>'+
        '</div>'+
        '<div class="cbox" style="margin-top:14px"><h4>'+IC.products+' Order Items</h4>'+
          '<div class="tablewrap"><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead><tbody>'+items+'</tbody></table></div>'+
        '</div>'+
        '<div class="cbox" style="margin-top:14px"><h4>'+IC.reports+' Price Breakdown</h4>'+
          '<div class="kv"><span class="k">Subtotal</span><span class="v">'+money(o.subtotal)+'</span></div>'+
          '<div class="kv"><span class="k">Delivery Fee</span><span class="v">'+money(o.deliveryFee)+'</span></div>'+
          '<div class="kv"><span class="k">Discount</span><span class="v">'+(o.discount>0?'-'+money(o.discount):money(0))+'</span></div>'+
          '<div class="kv" style="font-weight:800"><span class="k">Total Amount</span><span class="v" style="color:var(--br-ink);font-size:16px">'+money(o.total)+'</span></div>'+
        '</div>'+
      '</div>'+
      '<div>'+
        '<div class="cbox"><h4>'+IC.orders+' Order Status</h4>'+
          '<span class="pill" style="background:'+c.bg+';color:'+c.fg+';font-size:13px;padding:5px 13px"><span class="pd" style="background:'+c.dot+'"></span>'+LABEL[o.status]+'</span>'+
          '<div class="timeline" style="margin-top:14px">'+tl+'</div>'+
        '</div>'+
        '<div class="cbox" style="margin-top:14px"><h4>'+IC.card+' Payment & Delivery</h4>'+
          '<div class="kv"><span class="k">Method</span><span class="v" style="display:inline-flex;align-items:center;gap:7px">'+(o.paymentMethod==='online'?IC.card+'Online Payment':IC.wallet+'Cash on Delivery')+'</span></div>'+
          '<div class="kv"><span class="k">Payment Status</span><span class="v">'+payBadge(o.paymentStatus)+'</span></div>'+
          '<div class="kv"><span class="k">Delivery Partner</span><span class="v">'+esc(o.partnerName||'Unassigned')+'</span></div>'+
        '</div>'+
        '<div class="cbox" style="margin-top:14px"><h4>'+IC.delivery+' Order Actions</h4>'+
          '<div style="display:flex;flex-direction:column;gap:9px;align-items:stretch">'+
            nextBtn+paidBtn+waBtn+
            '<button class="btn ghost" data-act="assign" data-arg="'+esc(o.id)+'">'+IC.delivery+'&nbsp;Assign Delivery</button>'+
            '<button class="btn ghost" data-act="edit" data-arg="'+esc(o.id)+'">'+IC.edit+'&nbsp;Edit Order</button>'+
            '<button class="btn" data-act="copy" data-arg="'+esc(o.id)+'">'+IC.clipboard+'&nbsp;Copy Order ID</button>'+
            (o.status!=='delivered'&&o.status!=='cancelled'?'<button class="btn danger" data-act="cancel" data-arg="'+esc(o.id)+'">Cancel Order</button>':'')+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
}
function renderOrderDetail(){
  var o=state.order;
  var page=document.getElementById('page');
  var pageHtml=
    '<div class="detail-head"><div class="p-title"><button class="backl" data-go="#/orders">'+IC.back+'&nbsp;Orders</button>'+
    '<h1 style="margin-top:8px;display:flex;align-items:center;gap:10px">Order '+esc(o.id)+'</h1>'+
    '<p>Placed '+fmtTS(o.createdAt)+'</p></div>'+
    '<div class="p-actions">'+
      '<button class="btn" data-act="print" data-arg="'+esc(o.id)+'">'+IC.print+'&nbsp;Print Invoice</button>'+
    '</div></div>'+
    orderDetailBoxes(o);
  page.innerHTML=pageHtml;
  bindDelegates();
}
function openOrderDrawer(id){
  state._drw='order';state._drwArg=id;
  api('/api/orders/'+id).then(function(d){
    var o=d.order;
    state.order=o;
    var c=COLORS[o.status]||COLORS.received;
    openDrawer({
      title:'Order '+esc(o.id),
      sub:'<span class="pill" style="background:'+c.bg+';color:'+c.fg+';font-size:11px;padding:2px 9px"><span class="pd" style="background:'+c.dot+'"></span>'+LABEL[o.status]+'</span> · Placed '+fmtTS(o.createdAt)+' · '+money(o.total),
      icon:IC.orders,body:orderDetailBoxes(o),wide:true,
      foot:'<button class="btn" data-act="print" data-arg="'+esc(o.id)+'">'+IC.print+'&nbsp;Print Invoice</button><button class="btn" data-mb="x">Close</button>'
    });
  }).catch(function(){toast('Could not load order','err');});
}
function statusTimeline(status,history){
  var idx=ORDERS.indexOf(status);
  var hmap={};
  (history||[]).forEach(function(h){if(!hmap[h.to])hmap[h.to]=h.at;});
  return ORDERS.map(function(k,i){
    var cls=i<idx?'done':(i===idx?'cur':(i===idx+1?'next':''));
    var sub='';
    if(hmap[k])sub=fmtTS(hmap[k]);
    else if(i===0&&status!=='cancelled')sub='Auto';
    var icOn=i<=idx?'✓':String(i+1);
    return '<div class="tl '+cls+'"><div class="rail"><div class="dot">'+icOn+'</div>'+(i<ORDERS.length-1?'<div class="ln"></div>':'')+'</div><div class="t-body"><div class="t-label">'+LABEL[k]+'</div><div class="t-sub">'+sub+'</div></div></div>';
  }).join('');
}

/* ------------------------------ products ------------------------------ */

function vProducts(){
  api('/api/products').then(function(d){
    state.products=d.products||[];
    state.categories=d.categories||[];
    renderProducts();
  }).catch(function(){});
}
function renderProducts(){
  var page=document.getElementById('page');
  var q=state.prodQ.toLowerCase();
  var cats=[''].concat(state.categories);
  var rows=state.products.filter(function(p){
    var okC=!state.prodCat||state.prodCat==='all'||p.category===state.prodCat;
    var okQ=!q||p.item.toLowerCase().indexOf(q)>-1;
    return okC&&okQ;
  });
  var html='<div class="tablewrap"><table><thead><tr><th>Product</th><th>Image</th><th>Category</th><th style="text-align:right">Price</th><th style="text-align:right">Discount</th><th>Unit</th><th style="text-align:right">Stock</th><th>GST</th><th>Status</th><th></th></tr></thead><tbody>'+
    rows.map(function(p){
      var on=p.active?'<span class="pill" style="background:var(--br-soft);color:var(--br-ink)">Active</span>':'<span class="pill" style="background:#f3ece1;color:#7a766e">Disabled</span>';
      var stk=p.stock<=0?'<span class="pill" style="background:var(--red-soft);color:var(--red)">Out of Stock</span>':(p.stock<=p.low_stock_level?'<span class="pill" style="background:var(--amber-soft);color:var(--amber)">Low Stock</span>':'<span class="pill" style="background:var(--br-soft);color:var(--br-ink)">In Stock</span>');
      return '<tr>'+
        '<td><b>'+esc(p.item)+'</b></td>'+
        '<td>'+pImg(p)+'</td>'+
        '<td class="t-sub">'+esc(p.category)+'</td>'+
        '<td style="text-align:right" class="money">'+money(p.price)+'</td>'+
        '<td style="text-align:right" class="money">'+(p.discount_price?'<span style="color:var(--red)">-'+money(p.price-p.effectivePrice)+'</span>':'—')+'</td>'+
        '<td class="t-sub">'+esc(p.unit)+'</td>'+
        '<td>'+stk+'<div class="t-sub" style="text-align:center">'+p.stock+'</div></td>'+
        '<td class="t-sub">'+p.gst_rate+'%</td>'+
        '<td>'+on+'</td>'+
        '<td style="white-space:nowrap;text-align:right">'+
          '<button class="linkbtn" data-act="toggle" data-arg="'+p.id+'" data-on="'+(p.active?'0':'1')+'">'+(p.active?'Disable':'Enable')+'</button>'+
          '<button class="linkbtn" data-act="edit-p" data-arg="'+p.id+'">Edit</button>'+
          '<button class="linkbtn red" data-act="del-p" data-arg="'+p.id+'">Delete</button>'+
        '</td></tr>';
    }).join('')+
    '</tbody></table></div>';
  if(!rows.length)html='<div class="empty"><div class="eic">'+IC.products+'</div><div class="et">No products found</div></div>';
  page.innerHTML=
    '<div class="p-head"><div class="p-title"><h1>Products</h1><p>Manage your product catalogue.</p></div>'+
    '<div class="p-actions"><button class="btn" data-act="refresh" data-arg="products">'+IC.refresh+'&nbsp;Refresh</button><button class="btn primary" data-act="add-p">'+IC.plus+'&nbsp;Add Product</button></div></div>'+
    '<div class="panel">'+
      '<div class="ftool"><div class="fsearch" style="position:relative">'+IC.search+'<input id="pQ" style="padding-left:32px;position:absolute;left:0;right:0" placeholder="Search products..."/></div>'+
      '<select id="pCat"><option value="all">All categories</option>'+cats.filter(function(c){return c;}).map(function(c){return '<option value="'+esc(c)+'"'+(state.prodCat===c?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'</select></div>'+
      html+
    '</div>';
  bindDelegates();
  var pQ=document.getElementById('pQ');
  if(pQ){pQ.value=state.prodQ;pQ.addEventListener('input',function(){state.prodQ=this.value;renderProducts();});}
  var pCat=document.getElementById('pCat');
  if(pCat){pCat.value=state.prodCat||'all';pCat.addEventListener('change',function(){state.prodCat=this.value;renderProducts();});}
}
function openProductForm(pid){
  var isNew=!pid;
  var p=isNew?null:state.products.find(function(x){return x.id===pid;});
  var cats=state.categories.map(function(c){return '<option value="'+esc(c)+'"'+(p&&p.category===c?' selected':'')+'>'+esc(c)+'</option>';}).join('');
  var body=
    '<div class="d-sec"><span class="s-ic">'+IC.products+'</span>Product Information</div>'+
    '<div class="f-group"><label>Product Name</label><input id="pf-name" value="'+(p?esc(p.item):'')+'" placeholder="e.g. Ponni Rice"/></div>'+
    '<div class="f-row"><div class="f-group"><label>Category</label><select id="pf-cat">'+cats+'<option value="">+ New category</option></select></div>'+
    '<div class="f-group"><label>New Category</label><input id="pf-catnew" placeholder="Only if new"/></div></div>'+
    '<div class="d-sec"><span class="s-ic">'+IC.rupee+'</span>Pricing</div>'+
    '<div class="f-row3"><div class="f-group"><label>Price (₹)</label><input id="pf-price" type="number" step="0.01" value="'+(p?p.price:'')+'"/></div>'+
    '<div class="f-group"><label>Discount (₹)</label><input id="pf-disc" type="number" step="0.01" value="'+(p&&p.discount_price?p.discount_price:'')+'"/></div>'+
    '<div class="f-group"><label>GST %</label><input id="pf-gst" type="number" step="0.1" value="'+(p?p.gst_rate:0)+'"/></div></div>'+
    '<div class="f-group"><label>Unit</label><input id="pf-unit" value="'+(p?esc(p.unit):'kg')+'"/></div>'+
    '<div class="d-sec"><span class="s-ic">'+IC.inventory+'</span>Inventory</div>'+
    '<div class="f-row"><div class="f-group"><label>Current Stock</label><input id="pf-stock" type="number" value="'+(p?p.stock:0)+'"/></div>'+
    '<div class="f-group"><label>Low Stock Alert Level</label><input id="pf-low" type="number" value="'+(p?p.low_stock_level:5)+'"/></div></div>'+
    '<div class="d-sec"><span class="s-ic">'+IC.box+'</span>Image</div>'+
    '<div class="f-group"><label>Image URL</label><input id="pf-img" value="'+(p?esc(p.image):'')+'" placeholder="https://..."/><div class="t-sub" style="margin-top:4px">Leave empty to use the ZIPRA placeholder image.</div></div>'+
    '<div class="d-sec"><span class="s-ic">'+IC.settings+'</span>Status</div>'+
    '<div class="f-group"><label>Availability</label><select id="pf-active"><option value="1"'+(p&&p.active?' selected':'')+'>Active</option><option value="0"'+(p&&!p.active?' selected':'')+'>Disabled</option></select></div>';
  var foot='<button class="btn" data-mb="pf-cancel">Cancel</button><button class="btn primary" data-mb="p-save">'+IC.check+'&nbsp;'+(isNew?'Add Product':'Save Changes')+'</button>';
  openDrawer({
    title:(isNew?'Add Product':'Edit Product')+' · '+(p?esc(p.item):'New'),
    sub:isNew?'Create a new item for the catalog':'Update product information',
    icon:IC.products,body:body,foot:foot,
    cb:function(id){
      if(id!=='p-save')return;
      var cat=document.getElementById('pf-cat').value;
      var catNew=document.getElementById('pf-catnew').value.trim();
      var body={
        name:document.getElementById('pf-name').value.trim(),
        image:document.getElementById('pf-img').value.trim(),
        category:catNew||cat,
        price:num(document.getElementById('pf-price').value),
        discount_price:document.getElementById('pf-disc').value,
        gst_rate:num(document.getElementById('pf-gst').value),
        unit:document.getElementById('pf-unit').value.trim()||'kg',
        stock:num(document.getElementById('pf-stock').value),
        low_stock_level:num(document.getElementById('pf-low').value,5),
        active:document.getElementById('pf-active').value==='1'
      };
      if(!body.name){toast('Name required','err');return;}
      var req=isNew?api('/api/products',{method:'POST',body:body}):api('/api/products/'+pid,{method:'PUT',body:body});
      req.then(function(){closeDrawer();toast(isNew?'Product added':'Product saved');vProducts();}).catch(function(){toast('Save failed','err');});
    }
  });
}

/* ------------------------------ inventory ------------------------------ */

function vInventory(){
  api('/api/inventory').then(function(d){
    state.inventory=d.inventory||[];
    renderInventory();
  }).catch(function(){});
}
function renderInventory(){
  var page=document.getElementById('page');
  var rows=state.inventory.map(function(i){
    var badge=i.status==='out'?'<span class="pill" style="background:var(--red-soft);color:var(--red)"><span class="pd" style="background:var(--red)"></span>Out of Stock</span>'
      :(i.status==='low'?'<span class="pill" style="background:var(--amber-soft);color:var(--amber)"><span class="pd" style="background:#f59e0b"></span>Low Stock</span>'
      :'<span class="pill" style="background:var(--br-soft);color:var(--br-ink)"><span class="pd" style="background:#FF6B00"></span>In Stock</span>');
    return '<tr>'+
      '<td><div style="display:flex;align-items:center;gap:10px">'+pImg({image:i.image})+'<b>'+esc(i.name)+'</b></div></td>'+
      '<td style="text-align:right" class="money">'+i.stock+'</td>'+
      '<td class="t-sub">'+esc(i.unit)+'</td>'+
      '<td style="text-align:center" class="money">'+i.low_stock_level+'</td>'+
      '<td>'+badge+'</td>'+
      '<td class="t-sub">'+esc(i.category)+'</td>'+
      '<td style="text-align:right;white-space:nowrap">'+
        '<button class="linkbtn" data-act="adj" data-arg="'+i.id+'" data-op="+">Add Stock</button>'+
        '<button class="linkbtn" data-act="adj" data-arg="'+i.id+'" data-op="-">Remove</button>'+
        '<button class="linkbtn" data-act="adj" data-arg="'+i.id+'" data-op="=">Adjust</button>'+
      '</td></tr>';
  }).join('');
  page.innerHTML=
    '<div class="p-head"><div class="p-title"><h1>Inventory</h1><p>Stock levels and adjustments.</p></div>'+
    '<div class="p-actions"><button class="btn" data-act="refresh" data-arg="inventory">'+IC.refresh+'&nbsp;Refresh</button><button class="btn" data-act="inv-hist">'+IC.reports+'&nbsp;Stock History</button></div></div>'+
    '<div class="panel"><div class="tablewrap"><table><thead><tr><th>Product</th><th style="text-align:right">Current Stock</th><th>Unit</th><th style="text-align:center">Low Stock Level</th><th>Stock Status</th><th>Category</th><th></th></tr></thead><tbody>'+(rows||'')+'</tbody></table>'+
    (state.inventory.length?'':'<div class="empty">No inventory found</div>')+'</div></div>';
  bindDelegates();
}
function openAdjust(pid,op){
  var i=state.inventory.find(function(x){return x.id===pid;});
  if(!i)return;
  if(op==='=')op='';
  var body=
    '<input type="hidden" id="adj-id" value="'+pid+'"/>'+
    '<div class="d-sec"><span class="s-ic">'+IC.inventory+'</span>Inventory Adjustment</div>'+
    '<div class="d-card" style="cursor:default"><span class="d-ic">'+IC.box+'</span><div style="flex:1"><b>'+esc(i.name)+'</b><div class="t-sub">'+esc(i.category)+'</div></div><div style="text-align:right"><div class="t-sub">Current stock</div><b style="font-size:16px">'+i.stock+' '+esc(i.unit)+'</b></div></div>'+
    '<div style="margin-top:14px" class="f-row"><div class="f-group"><label>Operation</label><select id="adj-op"><option value="+"'+(op!=='-'?' selected':'')+'>Add Stock</option><option value="-"'+((op==='-'||op==='')?' selected':'')+'>Remove Stock</option></select></div>'+
    '<div class="f-group"><label>Quantity</label><input id="adj-qty" type="number" value="1" min="1"/></div></div>'+
    '<div class="f-group"><label>Reason</label><input id="adj-reason" placeholder="e.g. new stock received, damaged, count"/></div>'+
    '<div class="d-preview" id="adj-prev"></div>';
  var foot='<button class="btn" data-mb="adj-cancel">Cancel</button><button class="btn primary" data-mb="adj-go">'+IC.check+'&nbsp;Update Stock</button>';
  openDrawer({
    title:'Adjust Stock',sub:esc(i.name),icon:IC.inventory,body:body,foot:foot,
    onopen:function(){
      var upd=function(){
        var q=num(document.getElementById('adj-qty').value,0);
        var oo=document.getElementById('adj-op').value;
        var delta=oo==='-'?-q:q;
        var na=i.stock+delta;
        document.getElementById('adj-prev').innerHTML=
          '<div class="pv-row"><span>Current stock</span><span><b>'+i.stock+' '+esc(i.unit)+'</b></span></div>'+
          '<div class="pv-row"><span>Adjustment</span><span><b style="color:'+(delta<0?'var(--red)':'var(--br-dark)')+'">'+(delta>0?'+':'')+delta+' '+esc(i.unit)+'</b></span></div>'+
          '<div class="pv-row pv-new"><span>New stock</span><span class="pv-v"><b>'+Math.max(0,na)+' '+esc(i.unit)+'</b></span></div>';
      };
      document.getElementById('adj-op').addEventListener('change',upd);
      document.getElementById('adj-qty').addEventListener('input',upd);
      upd();
    },
    cb:function(id){
      if(id!=='adj-go')return;
      var delta=num(document.getElementById('adj-qty').value,0);
      var o=document.getElementById('adj-op').value;
      if(delta<=0){toast('Enter a quantity','err');return;}
      if(o==='-')delta=-delta;
      api('/api/inventory/adjust',{method:'POST',body:{productId:pid,delta:delta,reason:document.getElementById('adj-reason').value.trim()||'Manual adjustment'}})
        .then(function(){closeDrawer();toast('Stock updated');vInventory();}).catch(function(e){toast((e.message||'Adjust failed'),'err');});
    }
  });
}
function vInvHist(){
  api('/api/inventory/history').then(function(d){
    var rows=(d.history||[]).map(function(h){
      var col=h.change>0?'color:var(--br-ink)':'color:var(--red)';
      return '<tr><td>'+esc(h.product)+'</td><td style="color:'+col+';font-weight:700">'+(h.change>0?'+':'')+h.change+'</td><td class="t-sub">'+h.qty_before+' → '+h.qty_after+'</td><td>'+esc(h.reason||'—')+'</td><td class="t-sub">'+fmtTS(h.created_at)+'</td></tr>';
    }).join('');
    var body='<div class="panel"><div class="tablewrap"><table><thead><tr><th>Product</th><th>Change</th><th>Stock</th><th>Reason</th><th>Date</th></tr></thead><tbody>'+rows+'</tbody></table>'+(rows?'':'<div class="empty">No stock movements yet</div>')+'</div></div>';
    openDrawer({title:'Stock History',sub:'All inventory movements',icon:IC.inventory,body:body,foot:'<button class="btn" data-mb="x">Close</button>',wide:true});
  });
}

/* ------------------------------ customers ------------------------------ */

function vCustomers(){
  api('/api/customers').then(function(d){
    state.cust=d.customers||[];
    renderCustomers();
  }).catch(function(){});
}
function renderCustomers(){
  var page=document.getElementById('page');
  var statusBadge=function(s){
    if(s==='VIP')return '<span class="pill" style="background:#f3e8ff;color:#6b21a8">VIP</span>';
    if(s==='Regular')return '<span class="pill" style="background:var(--br-soft);color:var(--br-ink)">Regular</span>';
    if(s==='New')return '<span class="pill" style="background:#e8f1ff;color:#1e4fbf">New</span>';
    return '<span class="pill" style="background:#f3ece1;color:#7a766e">Inactive</span>';
  };
  var rows=state.cust.map(function(c){
    return '<tr class="trow" data-go="#/customers/'+c.id+'" data-drawer="customer">'+
      '<td><div class="cust"><span class="av">'+initials(c.name)+'</span><b>'+esc(c.name||'—')+'</b></div></td>'+
      '<td class="t-sub" style="font-variant-numeric:tabular-nums">'+esc(c.phone||'—')+'</td>'+
      '<td class="t-sub">'+esc((c.email)||'—')+'</td>'+
      '<td style="text-align:center" class="money">'+c.totalOrders+'</td>'+
      '<td style="text-align:right" class="money">'+money(c.totalSpent)+'</td>'+
      '<td class="t-sub">'+fmtDateD(c.lastOrder)+'</td>'+
      '<td>'+statusBadge(c.status)+'</td>'+
    '</tr>';
  }).join('');
  page.innerHTML=
    '<div class="p-head"><div class="p-title"><h1>Customers</h1><p>Everyone who orders with ZIPRA.</p></div>'+
    '<div class="p-actions"><button class="btn" data-act="refresh" data-arg="customers">'+IC.refresh+'&nbsp;Refresh</button></div></div>'+
    '<div class="panel"><div class="tablewrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th style="text-align:center">Total Orders</th><th style="text-align:right">Total Spent</th><th>Last Order</th><th>Status</th></tr></thead><tbody>'+(rows||'')+'</tbody></table>'+
    (state.cust.length?'':'<div class="empty">No customers yet.</div>')+'</div></div>';
  bindDelegates();
}
function customerDetail(c){
  var rows=(c.orders||[]).map(function(o){
    return '<div class="d-card" data-go="#/orders/'+esc(o.id)+'" data-drawer="order"><span class="d-ic">'+IC.orders+'</span><div style="flex:1"><div class="t-id">'+esc(o.id)+'</div><div class="t-sub">'+fmtTS(o.createdAt)+'</div></div><div style="text-align:right"><div class="money" style="font-weight:700">'+money(o.total)+'</div><div style="margin-top:5px">'+pill(o.status)+'</div></div></div>';
  }).join('');
  var body=
    '<div class="d-card" style="cursor:default;margin:0 0 14px"><span class="av" style="width:42px;height:42px;font-size:15px">'+initials(c.name)+'</span><div style="flex:1"><b>'+esc(c.name||'—')+'</b><div class="t-sub">'+esc(c.email||'No email')+'</div></div><div style="text-align:right"><div class="t-sub">Status</div><b style="color:var(--br-ink)">'+esc(c.status||'—')+'</b></div></div>'+
    '<div class="f-group"><label>Phone</label><input readonly value="'+esc(c.phone||'—')+'"/></div>'+
    '<div class="f-group"><label>Address</label><textarea rows="2" readonly>'+esc(c.address||'—')+'</textarea></div>'+
    '<div class="kpi-mini" style="margin:2px 0 0">'+
      '<div class="stat"><div class="sic" style="background:var(--br-soft);color:var(--br)">'+IC.orders+'</div><div><div class="sl">Total Orders</div><div class="sv">'+c.totalOrders+'</div></div></div>'+
      '<div class="stat"><div class="sic" style="background:var(--amber-soft);color:var(--amber)">'+IC.rupee+'</div><div><div class="sl">Total Spent</div><div class="sv">'+money(c.totalSpent)+'</div></div></div>'+
      '<div class="stat"><div class="sic" style="background:#e8f1ff;color:var(--blue)">'+IC.delivery+'</div><div><div class="sl">Last Order</div><div class="sv" style="font-size:13px">'+fmtDateD(c.lastOrder)+'</div></div></div>'+
    '</div>'+
    '<div class="d-sec"><span class="s-ic">'+IC.orders+'</span>Order History</div>'+
    (rows||'<div class="empty">No orders yet.</div>');
  return body;
}
function vCustomer(){
  api('/api/customers/'+state.arg).then(function(d){
    var c=d.customer;
    var page=document.getElementById('page');
    page.innerHTML=
      '<div class="detail-head"><div class="p-title"><button class="backl" data-go="#/customers">'+IC.back+'&nbsp;Customers</button>'+
      '<h1 style="margin-top:8px">'+esc(c.name||'Customer')+'</h1><p>'+esc(c.phone||'—')+(c.email?' · '+esc(c.email):'')+'</p></div></div>'+
      '<div class="grid2"><div class="cbox">'+customerDetail(c)+'</div>'+
      '<div><a class="btn" href="'+connectWa(c.phone)+'" target="_blank" rel="noopener">'+IC.wa+'&nbsp;WhatsApp</a> <button class="btn" data-go="#/orders">'+IC.orders+'&nbsp;View Orders</button></div></div>';
    bindDelegates();
  }).catch(function(){var page=document.getElementById('page');page.innerHTML='<div class="empty">Customer not found</div>';});
}
function openCustomerDrawer(id){
  state._drw='customer';state._drwArg=id;
  api('/api/customers/'+id).then(function(d){
    var c=d.customer;
    openDrawer({
      title:esc(c.name||'Customer'),sub:esc(c.phone||'—'),icon:IC.customers,
      body:customerDetail(c),wide:true,
      foot:'<a class="btn" href="'+connectWa(c.phone)+'" target="_blank" rel="noopener">'+IC.wa+'&nbsp;WhatsApp</a><button class="btn" data-mb="x">Close</button>'
    });
  }).catch(function(){toast('Could not load customer','err');});
}

/* ------------------------------ partners ------------------------------ */

function vPartners(){
  api('/api/delivery-partners').then(function(d){
    state.partners=d.partners||[];
    renderPartners();
  }).catch(function(){});
}
function renderPartners(){
  var page=document.getElementById('page');
  var rows=state.partners.map(function(p){
    var on=p.online?'<span class="pill" style="background:var(--br-soft);color:var(--br-ink)"><span class="pd" style="background:#FF6B00"></span>Online</span>':'<span class="pill" style="background:#f3ece1;color:#7a766e"><span class="pd" style="background:#9aa0a6"></span>Offline</span>';
    return '<tr>'+
      '<td><div class="cust"><span class="av">'+initials(p.name)+'</span><b>'+esc(p.name)+'</b></div></td>'+
      '<td class="t-sub" style="font-variant-numeric:tabular-nums">'+esc(p.phone||'—')+'</td>'+
      '<td>'+(p.online?'<button class="switch on" data-act="togp" data-arg="'+p.id+'" data-on="0" title="Go offline"></button>':'<button class="switch" data-act="togp" data-arg="'+p.id+'" data-on="1" title="Go online"></button>')+'</td>'+
      '<td style="text-align:center" class="money">'+p.activeOrders+'</td>'+
      '<td style="text-align:center" class="money">'+p.totalDeliveries+'</td>'+
      '<td style="text-align:right" class="money">'+money(p.earnings)+'</td>'+
      '<td style="text-align:right;white-space:nowrap">'+
        '<button class="linkbtn" data-act="edit-pn" data-arg="'+p.id+'">Edit</button>'+
        '<button class="linkbtn red" data-act="del-pn" data-arg="'+p.id+'">Delete</button>'+
      '</td></tr>';
  }).join('');
  page.innerHTML=
    '<div class="p-head"><div class="p-title"><h1>Delivery Partners</h1><p>Your delivery team and their performance.</p></div>'+
    '<div class="p-actions"><button class="btn primary" data-act="add-pn">'+IC.plus+'&nbsp;Add Partner</button></div></div>'+
    '<div class="panel"><div class="tablewrap"><table><thead><tr><th>Partner</th><th>Phone</th><th>Status</th><th style="text-align:center">Active Orders</th><th style="text-align:center">Total Deliveries</th><th style="text-align:right">Earnings</th><th></th></tr></thead><tbody>'+(rows||'')+'</tbody></table>'+
    (state.partners.length?'':'<div class="empty">No delivery partners yet. Add your first partner.</div>')+'</div></div>';
  bindDelegates();
}
function openPartnerForm(id){
  var p=id?state.partners.find(function(x){return x.id===id;}):null;
  var body=
    '<div class="d-sec"><span class="s-ic">'+IC.partners+'</span>Partner Details</div>'+
    '<div class="f-group"><label>Partner Name</label><input id="pn-name" value="'+(p?esc(p.name):'')+'"/></div>'+
    '<div class="f-group"><label>Phone</label><input id="pn-phone" value="'+(p?esc(p.phone):'')+'"/></div>'+
    '<div class="d-sec"><span class="s-ic">'+IC.delivery+'</span>Status</div>'+
    '<div class="f-group"><label>Availability</label><select id="pn-on"><option value="1"'+(p&&p.online?' selected':'')+'>Online</option><option value="0"'+(p&&!p.online?' selected':'')+'>Offline</option></select></div>';
  var foot='<button class="btn" data-mb="x">Cancel</button><button class="btn primary" data-mb="pns">'+IC.check+'&nbsp;'+(id?'Save':'Add')+'</button>';
  openDrawer({
    title:id?'Edit Partner':'Add Partner',sub:id&&p?esc(p.name):'Delivery team member',icon:IC.partners,body:body,foot:foot,
    cb:function(aid){
      if(aid!=='pns')return;
      var body={name:document.getElementById('pn-name').value.trim(),phone:document.getElementById('pn-phone').value.trim(),online:document.getElementById('pn-on').value==='1'};
      if(!body.name){toast('Name required','err');return;}
      var req=id?api('/api/delivery-partners/'+id,{method:'PUT',body:body}):api('/api/delivery-partners',{method:'POST',body:body});
      req.then(function(){closeDrawer();toast(id?'Partner updated':'Partner added');vPartners();}).catch(function(){toast('Save failed','err');});
    }
  });
}

/* ------------------------------ reports ------------------------------ */

function vReports(){
  api('/api/reports').then(function(d){
    var r=d.reports;
    var page=document.getElementById('page');
    var max=Math.max.apply(null,r.last7Days.map(function(x){return x.revenue;}).concat([1]));
    var bars=r.last7Days.map(function(x){
      var h=Math.round((x.revenue/max)*140)+6;
      return '<div class="bc"><div class="b-v">'+money(x.revenue).replace('₹','')+'</div><div class="bar" style="height:'+h+'px"></div><div class="b-l">'+x.label+'</div></div>';
    }).join('');
    var topMax=Math.max.apply(null,r.topProducts.map(function(t){return t.qty;}).concat([1]));
    var topl='';
    if(!r.topProducts.length)topl='<div class="empty">No sales data yet.</div>';
    else topl=r.topProducts.map(function(t,i){
      return '<div class="tlp"><span class="rank">'+(i+1)+'</span><span style="flex:1;min-width:0"><b>'+esc(t.name)+'</b><div class="barn"><i style="width:'+Math.max(6,Math.round((t.qty/topMax)*100))+'%"></i></div></span><span class="qty">'+t.qty+' sold</span></div>';
    }).join('');
    var srows=r.byStatus.map(function(s){
      return '<div class="tlp"><span style="flex:1">'+pill(s.status)+'</span><span class="qty">'+s.count+' orders</span></div>';
    }).join('');
    page.innerHTML=
      '<div class="p-head"><div class="p-title"><h1>Reports</h1><p>Business performance at a glance.</p></div>'+
      '<div class="p-actions"><button class="btn" data-act="refresh" data-arg="reports">'+IC.refresh+'&nbsp;Refresh</button></div></div>'+
      '<div class="kpi-mini" style="margin-bottom:14px">'+
        '<div class="stat"><div class="sic" style="background:var(--br-soft);color:var(--br)">'+IC.orders+'</div><div><div class="sl">Today&apos;s Orders</div><div class="sv">'+r.todayOrders+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:var(--amber-soft);color:var(--amber)">'+IC.rupee+'</div><div><div class="sl">Today&apos;s Revenue</div><div class="sv">'+money(r.todayRevenue)+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:#e8f1ff;color:var(--blue)">'+IC.delivery+'</div><div><div class="sl">Weekly Revenue</div><div class="sv">'+money(r.weekRevenue)+'</div></div></div>'+
        '<div class="stat"><div class="sic" style="background:#f3e8ff;color:#6b21a8">'+IC.rupee+'</div><div><div class="sl">Monthly Revenue</div><div class="sv">'+money(r.monthRevenue)+'</div></div></div>'+
      '</div>'+
      '<div class="grid2">'+
        '<div class="cbox"><h4>'+IC.reports+' Last 7 Days Revenue</h4><div class="bar-chart">'+bars+'</div></div>'+
        '<div>'+
          '<div class="cbox" style="margin-bottom:14px"><h4>'+IC.products+' Top Selling Products</h4><div class="topl">'+topl+'</div></div>'+
        '</div>'+
      '</div>'+
      '<div class="grid2" style="margin-top:14px">'+
        '<div class="cbox"><h4>'+IC.orders+' Order Status Breakdown</h4><div class="topl">'+srows+'</div></div>'+
        '<div class="cbox"><h4>'+IC.reports+' Totals</h4>'+
          '<div class="kv"><span class="k">Delivered Orders</span><span class="v">'+r.delivered+'</span></div>'+
          '<div class="kv"><span class="k">Cancelled Orders</span><span class="v">'+r.cancelled+'</span></div>'+
          '<div class="kv"><span class="k">Week Revenue</span><span class="v">'+money(r.weekRevenue)+'</span></div>'+
          '<div class="kv"><span class="k">Month Revenue</span><span class="v">'+money(r.monthRevenue)+'</span></div>'+
        '</div>'+
      '</div>';
    bindDelegates();
  }).catch(function(){});
}

/* ------------------------------ promotions ------------------------------ */

function vPromotions(){
  api('/api/promotions').then(function(d){
    state.promotions=d.promotions||[];
    renderPromotions();
  }).catch(function(){});
}
function renderPromotions(){
  var page=document.getElementById('page');
  var rows=state.promotions.map(function(p){
    return '<tr>'+
      '<td class="t-id">'+esc(p.code)+'</td>'+
      '<td>'+esc(p.title||'—')+'</td>'+
      '<td class="t-sub" style="text-transform:capitalize">'+p.type+'</td>'+
      '<td style="text-align:right" class="money">'+(p.type==='percent'?p.value+'%':'₹'+p.value)+'</td>'+
      '<td style="text-align:right" class="money">'+money(p.minOrder)+'</td>'+
      '<td>'+(p.active?'<span class="pill" style="background:var(--br-soft);color:var(--br-ink)">Active</span>':'<span class="pill" style="background:#f3ece1;color:#7a766e">Inactive</span>')+'</td>'+
      '<td style="text-align:right;white-space:nowrap">'+
        '<button class="linkbtn" data-act="edit-pr" data-arg="'+p.id+'">Edit</button>'+
        '<button class="linkbtn red" data-act="del-pr" data-arg="'+p.id+'">Delete</button>'+
      '</td></tr>';
  }).join('');
  page.innerHTML=
    '<div class="p-head"><div class="p-title"><h1>Promotions</h1><p>Coupons and offers for your store.</p></div>'+
    '<div class="p-actions"><button class="btn primary" data-act="add-pr">'+IC.plus+'&nbsp;New Promotion</button></div></div>'+
    '<div class="panel"><div class="tablewrap"><table><thead><tr><th>Code</th><th>Title</th><th>Type</th><th style="text-align:right">Value</th><th style="text-align:right">Min Order</th><th>Status</th><th></th></tr></thead><tbody>'+(rows||'')+'</tbody></table>'+
    (state.promotions.length?'':'<div class="empty">No promotions yet.</div>')+'</div></div>';
  bindDelegates();
}
function openPromoForm(id){
  var p=id?state.promotions.find(function(x){return x.id===id;}):null;
  var body=
    '<div class="d-sec"><span class="s-ic">'+IC.promotions+'</span>Promotion</div>'+
    '<div class="f-group"><label>Coupon Code</label><input id="pr-code" value="'+(p?esc(p.code):'')+'" placeholder="OFFER10"/></div>'+
    '<div class="f-group"><label>Title</label><input id="pr-title" value="'+(p?esc(p.title):'')+'" placeholder="10% off all orders"/></div>'+
    '<div class="d-sec"><span class="s-ic">'+IC.reports+'</span>Discount</div>'+
    '<div class="f-row"><div class="f-group"><label>Type</label><select id="pr-type"><option value="percent"'+(p&&p.type==='percent'?' selected':'')+'>Percent</option><option value="fixed"'+(p&&p.type==='fixed'?' selected':'')+'>Fixed amount</option></select></div>'+
    '<div class="f-group"><label>Value</label><input id="pr-value" type="number" step="0.01" value="'+(p?p.value:10)+'"/></div></div>'+
    '<div class="f-group"><label>Minimum Order (₹)</label><input id="pr-min" type="number" value="'+(p?p.minOrder:0)+'"/></div>'+
    '<div class="d-sec"><span class="s-ic">'+IC.settings+'</span>Status</div>'+
    '<div class="f-group"><label>Availability</label><select id="pr-active"><option value="1"'+(p&&p.active?' selected':'')+'>Active</option><option value="0"'+(p&&!p.active?' selected':'')+'>Inactive</option></select></div>';
  var foot='<button class="btn" data-mb="x">Cancel</button><button class="btn primary" data-mb="prs">'+IC.check+'&nbsp;'+(id?'Save':'Create')+'</button>';
  openDrawer({
    title:id?'Edit Promotion':'New Promotion',sub:p?esc(p.code):'Add an offer for your store',icon:IC.promotions,body:body,foot:foot,
    cb:function(aid){
      if(aid!=='prs')return;
      var body={code:document.getElementById('pr-code').value.trim(),title:document.getElementById('pr-title').value.trim(),type:document.getElementById('pr-type').value,value:num(document.getElementById('pr-value').value),minOrder:num(document.getElementById('pr-min').value),active:document.getElementById('pr-active').value==='1'};
      if(!body.code){toast('Code required','err');return;}
      var req=id?api('/api/promotions/'+id,{method:'PUT',body:body}):api('/api/promotions',{method:'POST',body:body});
      req.then(function(){closeDrawer();toast(id?'Promotion saved':'Promotion created');vPromotions();}).catch(function(){toast('Save failed','err');});
    }
  });
}

/* ------------------------------ settings ------------------------------ */

function vSettings(){
  api('/api/settings').then(function(d){
    state.settings=d.settings||{};
    var page=document.getElementById('page');
    page.innerHTML=
      '<div class="p-head"><div class="p-title"><h1>Settings</h1><p>Store configuration.</p></div></div>'+
      '<div class="grid2">'+
        '<div class="cbox"><h4>'+IC.settings+' Store Details</h4>'+
          '<div class="f-group"><label>Store Name</label><input id="st-name" value="'+esc(state.settings.store_name)+'"/></div>'+
          '<div class="f-group"><label>Support Phone</label><input id="st-phone" value="'+esc(state.settings.phone)+'"/></div>'+
          '<div class="f-group"><label>Store Address</label><textarea id="st-address" rows="2">'+esc(state.settings.address)+'</textarea></div>'+
        '</div>'+
        '<div class="cbox"><h4>'+IC.reports+' Ordering</h4>'+
          '<div class="f-group"><label>Delivery Fee (₹)</label><input id="st-fee" type="number" step="0.01" value="'+state.settings.delivery_fee+'"/></div>'+
          '<div class="t-sub" style="margin-bottom:12px">The delivery fee is used when customers place orders over WhatsApp.</div>'+
          '<button class="btn primary" data-act="save-settings">'+IC.plus+'&nbsp;Save Settings</button>'+
        '</div>'+
      '</div>';
    bindDelegates();
  }).catch(function(){});
}
function saveSettings(){
  var body={
    store_name:document.getElementById('st-name').value.trim(),
    phone:document.getElementById('st-phone').value.trim(),
    address:document.getElementById('st-address').value.trim(),
    delivery_fee:num(document.getElementById('st-fee').value)
  };
  api('/api/settings',{method:'PUT',body:body}).then(function(){
    toast('Settings saved');
    var av=document.getElementById('profAv');av.textContent=initials(body.store_name);
  }).catch(function(){toast('Save failed','err');});
}

/* ------------------------------ actions ------------------------------ */

function openAddOrder(){
  api('/api/products').then(function(d){
    var opts=(d.products||[]).filter(function(p){return p.active;}).map(function(p){return '<option value="'+p.id+'" data-key="'+esc(p.category+'.'+p.item)+'" data-price="'+p.effectivePrice+'" data-unit="'+esc(p.unit)+'">'+esc(p.category+' / '+p.item)+' — ₹'+p.effectivePrice+'</option>';}).join('');
    var itemsBox='<div class="ibox" id="itemsBox"><div class="ib-sel"><div style="flex:1;min-width:0"><select class="ib-sel-p" style="width:100%">'+opts+'</select></div><input class="ib-qty" type="number" value="1" style="width:64px"/><button class="btn sm ghost ib-add">'+IC.plus+'&nbsp;Add Item</button></div><div id="ibList"></div></div>';
    var fee=num(state.settings.delivery_fee,30);
    var body=
      '<div class="d-sec"><span class="s-ic">'+IC.customers+'</span>Customer</div>'+
      '<div class="f-row"><div class="f-group"><label>Customer Name</label><input id="ao-name"/></div>'+
      '<div class="f-group"><label>Phone (WhatsApp)</label><input id="ao-phone" placeholder="91XXXXXXXXXX"/></div></div>'+
      '<div class="f-group"><label>Delivery Address</label><textarea id="ao-addr" rows="2"></textarea></div>'+
      '<div class="d-sec"><span class="s-ic">'+IC.products+'</span>Order Items</div>'+
      '<div class="f-group"><label>Items</label>'+itemsBox+'</div>'+
      '<div id="ao-sum" class="t-sub" style="margin:4px 0 2px">Subtotal '+money(0)+' · Delivery '+money(fee)+' · Total '+money(fee)+'</div>'+
      '<div class="d-sec"><span class="s-ic">'+IC.card+'</span>Payment & Delivery</div>'+
      '<div class="f-row"><div class="f-group"><label>Payment Method</label><select id="ao-pm"><option value="cod">Cash on Delivery</option><option value="online">Online Payment</option></select></div>'+
      '<div class="f-group"><label>Order Status</label><select id="ao-st"><option value="received">Received</option><option value="confirmed">Confirmed</option><option value="preparing">Preparing</option><option value="out_for_delivery">Out for Delivery</option><option value="delivered">Delivered</option></select></div></div>';
    var foot='<button class="btn" data-mb="ao-cancel">Cancel</button><button class="btn primary" data-mb="ao-go">'+IC.check+'&nbsp;Create Order</button>';
    openDrawer({
      title:'Add Order',sub:'Place a new order manually',icon:IC.orders,body:body,foot:foot,wide:true,
      onopen:function(){state._aoItems=[];bindAO();},
      cb:function(id){
        if(id!=='ao-go')return;
        if(!state._aoItems||!state._aoItems.length){toast('Add at least one item','err');return;}
        var items=state._aoItems.map(function(i){return {productId:i.id,key:i.key,qty:i.qty,price:i.price,unit:i.unit,item:i.item};});
        api('/api/orders',{method:'POST',body:{
          name:document.getElementById('ao-name').value.trim(),
          phone:document.getElementById('ao-phone').value.trim(),
          address:document.getElementById('ao-addr').value.trim(),
          items:items,
          paymentMethod:document.getElementById('ao-pm').value,
          status:document.getElementById('ao-st').value
        }}).then(function(d){
          closeDrawer();
          toast('Order '+d.order.id+' created');
          openOrderDrawer(d.order.id);
        }).catch(function(e){toast((e.message||'Create failed'),'err');});
      }
    });
  });
}
function bindAO(){
  var add=document.querySelector('.ib-add');
  if(add)add.onclick=function(){
    var sel=document.querySelector('.ib-sel-p');
    var qty=num(document.querySelector('.ib-qty').value,1);
    if(!sel||!qty)return;
    var opt=sel.options[sel.selectedIndex];
    var item={id:Number(opt.value),key:opt.getAttribute('data-key'),price:num(opt.getAttribute('data-price')),unit:opt.getAttribute('data-unit'),item:opt.text.split('—')[0].split('/').slice(1).join('/').trim(),qty:qty};
    state._aoItems.push(item);
    renderAOList();
  };
  renderAOList();
}
function renderAOList(){
  var host=document.getElementById('ibList');
  var sum=state._aoItems.reduce(function(s,i){return s+i.qty*i.price;},0);
  var fee=num(state.settings.delivery_fee,30);
  host.innerHTML=state._aoItems.map(function(i,idx){
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed #f3ece1;font-size:13px"><span style="flex:1">'+esc(i.item)+' × '+i.qty+'</span><span class="money">'+money(i.qty*i.price)+'</span><button class="linkbtn red" data-idx="'+idx+'">Remove</button></div>';
  }).join('');
  host.querySelectorAll('[data-idx]').forEach(function(b){
    b.onclick=function(){state._aoItems.splice(Number(b.getAttribute('data-idx')),1);renderAOList();};
  });
  var s2=document.getElementById('ao-sum');
  if(s2)s2.innerHTML='Subtotal '+money(sum)+' · Delivery '+money(fee)+' · Total '+money(sum+fee);
}

function openEditOrder(idc){
  api('/api/orders/'+idc).then(function(d){
    var o=d.order;
    var body=
      '<div class="d-sec"><span class="s-ic">'+IC.customers+'</span>Customer</div>'+
      '<div class="f-row"><div class="f-group"><label>Customer Name</label><input id="eo-name" value="'+esc(o.name||'')+'"/></div>'+
      '<div class="f-group"><label>Phone</label><input id="eo-phone" value="'+esc(o.waId||'')+'"/></div></div>'+
      '<div class="f-group"><label>Delivery Address</label><textarea id="eo-addr" rows="2">'+esc(o.address||'')+'</textarea></div>'+
      '<div class="d-sec"><span class="s-ic">'+IC.products+'</span>Order Items</div>'+
      '<div class="f-group"><label>Items (edit quantity)</label><div id="eo-items">'+
        (o.items||[]).map(function(it,idx){
          return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px dashed #f3ece1"><span style="flex:1">'+esc(it.item)+' <span class="t-sub">(₹'+it.price+'/'+esc(it.unit||'')+')</span></span><input type="number" class="eo-q" data-idx="'+idx+'" value="'+it.qty+'" style="width:66px"/></div>';
        }).join('')+
      '</div></div>'+
      '<div class="d-sec"><span class="s-ic">'+IC.card+'</span>Payment</div>'+
      '<div class="f-row"><div class="f-group"><label>Delivery Fee (₹)</label><input id="eo-fee" type="number" value="'+o.deliveryFee+'"/></div>'+
      '<div class="f-group"><label>Payment Method</label><select id="eo-pm"><option value="cod"'+(o.paymentMethod!=='online'?' selected':'')+'>COD</option><option value="online"'+(o.paymentMethod==='online'?' selected':'')+'>Online</option></select></div></div>';
    var foot='<button class="btn" data-mb="x">Cancel</button><button class="btn primary" data-mb="eo-save">'+IC.check+'&nbsp;Save Changes</button>';
    openDrawer({
      title:'Edit Order',sub:esc(o.id),icon:IC.orders,body:body,foot:foot,wide:true,
      cb:function(id){
        if(id!=='eo-save')return;
        var built=o.items.map(function(it,idx){
          var el=document.querySelectorAll('.eo-q')[idx];
          var qty=num(el?el.value:it.qty,1);
          return {productId:it.productId||undefined,key:undefined,item:it.item,unit:it.unit,qty:qty,price:it.price};
        });
        api('/api/orders/'+idc,{method:'PUT',body:{
          name:document.getElementById('eo-name').value.trim(),
          waId:document.getElementById('eo-phone').value.trim(),
          address:document.getElementById('eo-addr').value.trim(),
          items:built,
          deliveryFee:num(document.getElementById('eo-fee').value)
        }}).then(function(){
          toast('Order updated');
          afterOrderChange();
        }).catch(function(e){toast((e.message||'Update failed'),'err');});
      }
    });
  }).catch(function(){toast('Could not load order','err');});
}

function printInvoice(idc){
  api('/api/orders/'+idc).then(function(d){
    var o=d.order;
    var store=state.settings.store_name||'ZIPRA Grocery';
    var items=(o.items||[]).map(function(it){
      return '<tr><td>'+esc(it.item)+'</td><td>'+esc(it.unit||'')+'</td><td style="text-align:center">'+it.qty+'</td><td style="text-align:right">'+money(it.price)+'</td><td style="text-align:right">'+money(it.subtotal)+'</td></tr>';
    }).join('');
    var w=window.open('','_blank');
    var html='<!doctype html><html><head><title>Invoice '+esc(o.id)+'</title><style>body{font-family:Helvetica,Arial,sans-serif;color:#111;padding:34px;max-width:640px;margin:0 auto}table{width:100%;border-collapse:collapse}th,td{padding:7px 8px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}th{font-size:11px;text-transform:uppercase;color:#666}.h{border-bottom:3px solid #FF6B00;padding-bottom:14px;margin-bottom:18px;display:flex;justify-content:space-between}.tt{font-size:20px;font-weight:800}.sub{color:#666;font-size:12px}.tot{font-size:15px;font-weight:800;text-align:right}.kv{font-size:12.5px;color:#444;margin-top:3px}.accent{color:#E65100;font-weight:700}</style></head><body>'+
      '<div class="h"><div><div class="tt">'+esc(store)+'</div><div class="sub">Grocery Delivery · Order Invoice</div></div><div style="text-align:right"><div class="accent">TAX INVOICE</div><div class="sub">'+esc(o.id)+'</div></div></div>'+
      '<div style="display:flex;justify-content:space-between;margin-bottom:20px"><div><div class="kv">Billed to</div><div style="font-size:14px;font-weight:700">'+esc(o.name||'—')+'</div><div class="kv">+'+esc(o.waId||'—')+'</div></div><div style="text-align:right"><div class="kv">Order date</div><div style="font-size:14px">'+fmtTS(o.createdAt)+'</div><div class="kv">Status</div><div class="accent">'+LABEL[o.status]+'</div></div></div>'+
      '<table><thead><tr><th>Item</th><th>Unit</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>'+items+'</tbody></table>'+
      '<div style="margin:16px 0;width:240px;margin-left:auto">'+
        '<div class="kv" style="display:flex;justify-content:space-between"><span>Subtotal</span><span>'+money(o.subtotal)+'</span></div>'+
        '<div class="kv" style="display:flex;justify-content:space-between"><span>Delivery Fee</span><span>'+money(o.deliveryFee)+'</span></div>'+
        '<div class="kv" style="display:flex;justify-content:space-between"><span>Discount</span><span>'+(o.discount>0?'-'+money(o.discount):money(0))+'</span></div>'+
        '<div style="border-top:2px solid #111;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;font-size:15px;font-weight:800"><span>Total</span><span>'+money(o.total)+'</span></div>'+
      '</div>'+
      '<div class="kv" style="margin-top:14px">Payment: '+(o.paymentMethod==='online'?'Online Payment':'Cash on Delivery')+' · '+esc(o.paymentStatus)+'</div>'+
      '<div class="kv">Delivery Address: '+esc(safeAddr(o))+'</div>'+
      '<div class="sub" style="margin-top:26px;text-align:center">Thank you for shopping with ZIPRA 🧡</div>'+
      '</body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(function(){w.print();},350);
  }).catch(function(){toast('Could not load order','err');});
}

/* ------------------------------ delegation ------------------------------ */

function bindDelegates(){
  document.querySelectorAll('[data-act]').forEach(function(el){
    el.onclick=function(e){
      var act=el.getAttribute('data-act');
      var arg=el.getAttribute('data-arg');
      var op=el.getAttribute('data-op');
      var st=el.getAttribute('data-st');
      var on=el.getAttribute('data-on');
      e.preventDefault();
      e.stopPropagation();
      handleAct(act,arg,{op:op,st:st,on:on,btn:el});
    };
  });
}
function handleAct(act,arg,ctx){
  switch(act){
    case 'refresh':route();break;
    case 'add-order':openAddOrder();break;
    case 'next':
      conf('Advance order '+arg+' to "'+LABEL[ctx.st]+'"?').then(function(yes){
        if(!yes)return;
        api('/api/orders/'+arg+'/status',{method:'POST',body:{status:ctx.st,notify:true}})
          .then(function(d){toast((d.notified?'Status updated & customer notified':'Status updated'));afterOrderChange();})
          .catch(function(e){toast((e.message||'Update failed'),'err');});
      });
      break;
    case 'pay':
      api('/api/orders/'+arg+'/payment',{method:'POST',body:{status:'Paid'}})
        .then(function(){toast('Marked as Paid');afterOrderChange();})
        .catch(function(e){toast((e.message||'Update failed'),'err');});
      break;
    case 'cancel':
      conf('Cancel order '+arg+'? Stock will be restored.').then(function(yes){
        if(!yes)return;
        api('/api/orders/'+arg+'/status',{method:'POST',body:{status:'cancelled',notify:true}})
          .then(function(){toast('Order cancelled');afterOrderChange();})
          .catch(function(e){toast((e.message||'Cancel failed'),'err');});
      });
      break;
    case 'contact':
      api('/api/orders/'+arg).then(function(d){
        var o=d.order;
        var body=
          '<div class="d-card" style="cursor:default;margin:0 0 14px"><span class="d-ic">'+IC.orders+'</span><div style="flex:1"><b>'+esc(o.id)+'</b><div class="t-sub">'+esc(o.name||'')+' · '+esc(o.waId||'')+'</div></div></div>'+
          '<div class="f-group"><label>Message</label><textarea id="ct-msg" rows="4" placeholder="Leave empty for a status update notification">Order '+esc(o.id)+' update from ZIPRA</textarea></div>';
        var foot='<button class="btn" data-mb="x">Cancel</button><button class="btn primary" data-mb="ct-go">'+IC.check+'&nbsp;Send Message</button>';
        openDrawer({
          title:'Contact Customer',sub:esc(o.name||''),icon:IC.wa,body:body,foot:foot,slim:true,
          cb:function(id){
            if(id!=='ct-go')return;
            api('/api/orders/'+arg+'/notify',{method:'POST',body:{message:document.getElementById('ct-msg').value}})
              .then(function(res){toast(res.sent?'Message sent to customer':'Could not send',res.sent?'':'err');afterOrderChange();}).catch(function(e){toast((e.message||'Send failed'),'err');});
          }
        });
      });
      break;
    case 'assign':
      api('/api/delivery-partners').then(function(d){
        var ps=d.partners||[];
        var opts=ps.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+(p.online?' (online)':'')+'</option>';}).join('');
        var body=
          '<div class="f-group"><label>Delivery Partner</label><select id="ap-sel">'+(opts||'<option>No partners yet</option>')+'</select></div>'+
          '<div class="t-sub">The partner is credited with the delivery fee once the order is marked delivered.</div>';
        var foot='<button class="btn" data-mb="x">Cancel</button><button class="btn primary" data-mb="ap-go">'+IC.check+'&nbsp;Assign</button>';
        openDrawer({
          title:'Assign Delivery Partner',sub:'Order '+esc(arg),icon:IC.delivery,body:body,foot:foot,slim:true,
          cb:function(id){
            if(id!=='ap-go')return;
            var sel=document.getElementById('ap-sel');
            if(!sel||!sel.value){toast('Add a delivery partner first','err');return;}
            api('/api/orders/'+arg+'/assign',{method:'POST',body:{partnerId:Number(sel.value)}})
              .then(function(){toast('Delivery partner assigned');afterOrderChange();}).catch(function(e){toast((e.message||'Assign failed'),'err');});
          }
        });
      });
      break;
    case 'edit':openEditOrder(arg);break;
    case 'copy':
      navigator.clipboard.writeText(arg).then(function(){toast('Order ID copied');});
      break;
    case 'print':printInvoice(arg);break;
    case 'add-p':openProductForm(null);break;
    case 'edit-p':openProductForm(Number(arg));break;
    case 'del-p':
      conf('Delete product '+arg+'? This cannot be undone.').then(function(yes){
        if(!yes)return;
        api('/api/products/'+arg,{method:'DELETE'}).then(function(){toast('Product deleted');vProducts();}).catch(function(e){toast((e.message||'Delete failed'),'err');});
      });
      break;
    case 'toggle':
      api('/api/products/'+arg+'/toggle',{method:'POST',body:{active:ctx.on==='1'}})
        .then(function(){toast('Updated');vProducts();}).catch(function(e){toast((e.message||'Failed'),'err');});
      break;
    case 'adj':openAdjust(Number(arg),ctx.op);break;
    case 'inv-hist':vInvHist();break;
    case 'add-pn':openPartnerForm(null);break;
    case 'edit-pn':openPartnerForm(Number(arg));break;
    case 'del-pn':
      conf('Remove partner '+arg+'?').then(function(yes){
        if(!yes)return;
        api('/api/delivery-partners/'+arg,{method:'DELETE'}).then(function(){toast('Partner removed');vPartners();}).catch(function(e){toast((e.message||'Failed'),'err');});
      });
      break;
    case 'togp':
      api('/api/delivery-partners/'+arg,{method:'PUT',body:{online:ctx.on==='1'}})
        .then(function(){toast('Updated');vPartners();}).catch(function(e){toast((e.message||'Failed'),'err');});
      break;
    case 'add-pr':openPromoForm(null);break;
    case 'edit-pr':openPromoForm(Number(arg));break;
    case 'del-pr':
      conf('Delete promotion?').then(function(yes){
        if(!yes)return;
        api('/api/promotions/'+arg,{method:'DELETE'}).then(function(){toast('Promotion deleted');vPromotions();}).catch(function(e){toast((e.message||'Failed'),'err');});
      });
      break;
    case 'save-settings':saveSettings();break;
  }
}

/* ------------------------------ topbar ------------------------------ */

function bindTopbar(){
  var gq=document.getElementById('gq');
  gq.addEventListener('input',function(){
    state.filters.q=this.value;
    if(state.view!=='orders')go('#/orders');
    if(state.view==='orders'){loadOrders();}
  });
  document.getElementById('notifBtn').addEventListener('click',function(e){
    e.stopPropagation();
    toggleNotif();
  });
  document.getElementById('profBtn').addEventListener('click',function(e){
    e.stopPropagation();
    var d=document.getElementById('profDrop');
    d.classList.toggle('open');
    document.getElementById('notifDrop').classList.remove('open');
  });
  document.getElementById('logoutBtn').addEventListener('click',function(){
    token='';localStorage.removeItem('zipra_token');location.reload();
  });
  document.addEventListener('click',function(){
    document.getElementById('notifDrop').classList.remove('open');
    document.getElementById('profDrop').classList.remove('open');
  });
}
function toggleNotif(){
  var d=document.getElementById('notifDrop');
  d.innerHTML='<div class="spinrow" style="padding:20px"><div class="spinner" style="width:22px;height:22px"></div></div>';
  d.classList.toggle('open');
  document.getElementById('profDrop').classList.remove('open');
  api('/api/orders?status=received').then(function(data){
    var items=(data.orders||[]).slice(0,6);
    document.getElementById('notifDot').style.display=items.length?'block':'none';
    var rows=items.map(function(o){
      var c=COLORS[o.status]||COLORS.received;
      return '<div class="dd-item" data-go="#/orders/'+esc(o.id)+'" data-drawer="order"><span class="notif-ic" style="background:'+c.bg+';color:'+c.fg+'">'+IC.check+'</span><div><div class="d-t">'+esc(o.id)+' · '+LABEL[o.status]+'</div><div class="d-s">'+esc(o.name||'')+' · '+money(o.total)+' · '+fmtTS(o.createdAt)+'</div></div></div>';
    }).join('');
    d.innerHTML='<div class="dd-head"><b>Notifications</b><span style="color:var(--muted);font-size:12px;margin-left:6px">New orders</span></div>'+
      (rows?'<div id="notifItems">'+rows+'</div>':'<div class="dd-empty">No new order notifications.</div>')+
      '<div class="dd-item menu" data-go="#/orders"><div class="d-t">View all orders</div></div>';
    d.querySelectorAll('.dd-item').forEach(function(el){
      el.onclick=function(e){e.stopPropagation();document.getElementById('notifDrop').classList.remove('open');go(el.getAttribute('data-go'));};
    });
  }).catch(function(){});
}

/* ------------------------------ boot ------------------------------ */

document.addEventListener('click',function(e){
  var nv=e.target.closest('.nav-link');
  if(nv){go('#/'+nv.getAttribute('data-nav'));return;}
  var tr=e.target.closest('[data-go]');
  if(tr){e.preventDefault();
    var drw=tr.getAttribute('data-drawer');
    var ref=tr.getAttribute('data-go');
    if(drw==='order'){openOrderDrawer(String(ref).split('/').pop());}
    else if(drw==='customer'){openCustomerDrawer(String(ref).split('/').pop());}
    else go(ref);
  }
  var ch=e.target.closest('[data-ch]');
  if(ch){
    state.filters.status=ch.getAttribute('data-ch');
    var chips=document.querySelectorAll('.chip');
    chips.forEach(function(c){c.classList.toggle('on',c===ch);});
    loadOrders();
  }
});

window.addEventListener('hashchange',route);
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeDrawer();}});
window.addEventListener('load',function(){
  bindTopbar();
  var av=document.getElementById('profAv');
  api('/api/settings').then(function(d){
    state.settings=d.settings||state.settings;
    if(state.settings.store_name)av.textContent=initials(state.settings.store_name);
  }).catch(function(){});
  route();
});
</script>
</body>
</html>`;