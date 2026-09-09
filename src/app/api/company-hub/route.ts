import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { canViewIncidents, canViewKpi } from '@/lib/permissions';
export const dynamic = 'force-dynamic';

// A top-level connection window retains source login/IP rules. Only selected
// result fields leave this origin; cookies and credentials never do.
export async function GET(req: NextRequest) {
 const me = await getCurrentUser();
 if (!me) return new Response('กรุณาเข้าสู่ Domainwatch แล้วกลับไปกดเชื่อมผลใน Company Hub อีกครั้ง', {status:401});
 if (!canViewIncidents(me.role)) return new Response('บัญชีนี้ไม่มีสิทธิ์อ่านผลเหตุการณ์', {status:403});
 const from=req.nextUrl.searchParams.get('from')||'',to=req.nextUrl.searchParams.get('to')||'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||Date.parse(to)<Date.parse(from)||Date.parse(to)-Date.parse(from)>31*86400000) return new Response('ช่วงวันที่ไม่ถูกต้อง',{status:400});
 const detectedAt={gte:new Date(from+'T00:00:00+07:00'),lt:new Date(Date.parse(to+'T00:00:00+07:00')+86400000)};
 const person={select:{id:true,name:true}};
 const link={select:{name:true,company:{select:{id:true,name:true}}}};
 const [system,mobile,linkStates]=await Promise.all([ 
 prisma.incident.findMany({where:{detectedAt},take:5001,orderBy:{id:'asc'},select:{id:true,status:true,detectedAt:true,adminResponseMin:true,itResponseMin:true,adminUser:person,itUser:person,link}}),
 prisma.networkIncident.findMany({where:{detectedAt},take:5001,orderBy:{id:'asc'},select:{id:true,status:true,detectedAt:true,adminResponseMin:true,adminUser:person,link}}),
 prisma.link.groupBy({by:['lastStatus'],where:{isActive:true},_count:{_all:true}})
 ]);
 const rows=[...system.map(x=>({id:'SYSTEM:'+x.id,title:x.link.name,company:x.link.company.name,date:x.detectedAt.toISOString(),status:x.status,closed:x.status==='CLOSED',adminId:x.adminUser?.id||'',admin:x.adminUser?.name||'ยังไม่มอบหมาย',itId:x.itUser?.id||'',it:x.itUser?.name||'ยังไม่มอบหมาย',adminMin:canViewKpi(me.role)||x.adminUser?.id===me.id?x.adminResponseMin:null,itMin:canViewKpi(me.role)||x.itUser?.id===me.id?x.itResponseMin:null})),
 ...mobile.map(x=>({id:'MOBILE:'+x.id,title:x.link.name,company:x.link.company.name,date:x.detectedAt.toISOString(),status:x.status,closed:x.status==='CLOSED',adminId:x.adminUser?.id||'',admin:x.adminUser?.name||'ยังไม่มอบหมาย',itId:'',it:'ไม่ใช่งาน IT ในระบบต้นทาง',adminMin:canViewKpi(me.role)||x.adminUser?.id===me.id?x.adminResponseMin:null,itMin:null}))];
 const data=JSON.stringify({version:1,from,to,fetchedAt:new Date().toISOString(),partial:system.length>=5001||mobile.length>=5001,links:linkStates.map(x=>({status:x.lastStatus,count:x._count._all})),rows}).replace(/</g,'\\u003c');
 const html=`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>เชื่อมผล Domainwatch</title><style>body{font:16px system-ui;max-width:600px;margin:60px auto;padding:24px;color:#20304c}button{background:#2457c5;color:white;padding:16px;border:0;border-radius:10px;cursor:pointer}p{line-height:1.8}</style><h1>ผลแอดมินและ IT</h1><p>ส่งผลเหตุการณ์และผู้รับผิดชอบตามสิทธิ์บัญชีนี้ ไปแสดงใน Company Hub ไม่ส่งรหัสผ่านหรือเซสชัน</p><button id="send">แสดงผลใน Company Hub</button><p id="state"></p><script>const data=${data};const nonce=new URLSearchParams(location.hash.slice(1)).get('nonce');document.getElementById('send').onclick=()=>{if(!opener||!/^[a-f0-9]{32}$/.test(nonce||''))return;opener.postMessage({type:'company-hub-results',nonce,source:'domainwatch',data},'https://work89support.github.io');document.getElementById('state').textContent='ส่งผลให้ Company Hub แล้ว ปิดหน้าต่างนี้ได้';};</script></html>`;
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"}});
}
