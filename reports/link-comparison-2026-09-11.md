# เปรียบเทียบลิงก์ Google Sheet กับ DomainWatch

ตรวจวันที่ 11 กันยายน 2569 — อ่านข้อมูลเท่านั้น ไม่ได้แก้ไขหรือส่งการแจ้งเตือน

## แหล่งข้อมูลและวิธีเทียบ

- [Google Sheet: Master Data](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726): ข้อมูล 174 แถว (แถว 2–175) ตรวจส่วนท้ายถึงแถว 1001 ไม่พบข้อมูลบริษัท/ห้องเพิ่มเติม
- [หน้า Master Data ระบบที่เปิดตรวจ](https://domain-watch-bf1g45tvr-work-c1c3.vercel.app/links): รีโหลดและล้างตัวกรอง อ่านครบ 651 รายการ รวมรายการพักการเฝ้าดู
- เทียบคอลัมน์ D และ L/N/P/R/T/V รวม 899 ช่องที่เป็น HTTP/HTTPS โดยใช้บริษัท + ห้อง LINE + ชื่อรายการก่อน; หากชื่อไม่ตรงจึงค้น URL ภายในห้อง และระบุกรณีจับคู่ไม่แน่ชัด
- ไม่ตัด path, ref, invitekey หรือ query ออกจาก URL; ถือ host เปล่ากับ host ที่ลงท้าย / เป็น URL root เดียวกัน
- ช่องว่างและเครื่องหมาย - ไม่นับเป็นลิงก์; R164 เป็น / จึงแยกเป็นข้อมูลไม่สมบูรณ์
- เปรียบเทียบค่าที่บันทึก ไม่ใช่การทดสอบว่าเว็บเข้าได้ และไม่ได้ยืนยันข้อมูลที่ฝังจริงใน LINE OA หรือปลายทางของลิงก์สั้น
- การใช้ URL เดียวกันหลายริชเมนู/หลายห้องไม่ถือเป็นข้อผิดพลาดโดยตัวมันเอง

## ผลรวม

848 ช่องพบ URL ตรงกับรายการในห้องที่จับคู่ได้; 43 ช่องใน 27 ห้องต้องทบทวน และอีก 8 ช่องจับคู่ชื่อห้องไม่ได้ (2 ห้อง) รวม 899 ช่อง ตัวเลขเป็นจำนวนช่องในชีต ไม่ใช่จำนวนเว็บไซต์ไม่ซ้ำ และไม่ใช่จำนวนลิงก์เสีย

| บริษัท | ช่องต้องทบทวน | ห้อง | ชื่อห้องไม่ตรงเพิ่ม |
|---|---:|---:|---|
|3XB|2|2|—|
|MR9|2|1|—|
|MC8|19|9|—|
|UR9|1|1|—|
|PS8|2|1|—|
|FR8|8|6|3 ช่อง / 1 ห้อง|
|AT4|0|0|—|
|SK8|2|2|—|
|7M|7|5|5 ช่อง / 1 ห้อง|

## รายการต้องทบทวนทั้งหมด 43 ช่อง

“—” ในช่องสำรองหมายถึงไม่พบสำรองแสดงบนรายการระบบที่ใช้เทียบ ไม่ได้หมายความว่าไม่มี URL อื่นในห้อง

|บริษัท|ห้อง LINE|ช่องชีต|URL ในชีต|URL หลักในระบบ/รายการใกล้เคียงที่ระบุ|สำรองของรายการระบบ|ข้อสังเกต|
|---|---|---|---|---|---|---|
|3XB|@3xbetfree|[N6](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N6)|https://3xbet.services/aff/aff1932834|https://3xbet.services/aff/aff1891810|—|รหัสแนะนำต่างกัน|
|3XB|@ad3sv|[N24](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N24)|https://3xbet.money/aff/aff1932834|https://3xbet.services/aff/aff1932834|—|โดเมนต่างกัน|
|MR9|@mgin168free|[D33](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=D33), [P33](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=P33)|https://app.mgin168.com/|https://mclaren9.store/|—|ระบบใช้รายการชื่อ ทางเข้าเล่น|
|MC8|@nx9support|[D48](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=D48), [L48](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L48), [N48](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N48)|https://app.nsx999.com/|https://nsx999.run/|https://nsx999.pw/|หลักและสำรองต่างจากชีต; ระบบชื่อ ทางเข้าเล่น 2|
|MC8|@nx9sv|[D49](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=D49), [L49](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L49)|https://app.nsx999.com/|https://nsx999.run/|https://nsx999.pw/|หลักและสำรองต่างจากชีต|
|MC8|@nx9cash|[D50](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=D50), [L50](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L50), [N50](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N50), [V50](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=V50)|https://app.nsx999.com/|https://nsx999.run/|https://nsx999.pw/|ระบบชื่อ ทางเข้าเล่น 3|
|MC8|@nx9cash|[P50](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=P50)|https://app.nsx999.com/aff/aff1688727|https://nsx999.run/|https://nsx999.pw/|รายการสมัครในระบบไม่มี path รหัสแนะนำตามชีต|
|MC8|@nsx999sv|[R55](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=R55)|https://nsx999.pw/|https://mcc888.pw/|—|ไม่พบรายการชื่อ ทางเข้าตรงกัน; แสดงหน้าเข้าเล่นหลักของห้องเพื่อเทียบ ไม่ยืนยันว่าเป็นรายการเดียวกัน|
|MC8|@nsx999|[L56](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L56), [N56](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N56)|https://app.nsx999.com/aff/aff1688727|https://nsx999.run/|https://nsx999.pw/|สมัคร: หลักและสำรองไม่มี path รหัสแนะนำตามชีต|
|MC8|@978ysujp|[L57](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L57), [N57](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N57)|https://app.nsx999.com/aff/aff1688727|https://nsx999.run/|https://nsx999.pw/|สมัคร: หลักและสำรองไม่มี path รหัสแนะนำตามชีต|
|MC8|@061iibxp|[P58](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=P58)|https://mcc888.pw/|https://mcc888.pw/https://mcc888.pw/|—|URL ต่อซ้ำในรายการชื่อ ทางเข้า; ห้องนี้ยังมีหน้าเข้าเล่นหลักที่ตรงกับชีต แต่ไม่ได้ทำให้รายการทางเข้าที่ต่อซ้ำถูกต้อง|
|MC8|@mc8free|[L59](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L59)|https://app.nsx999.com/aff/aff1688727|https://nsx999.run/|https://nsx999.pw/|สมัคร: หลักและสำรองไม่มี path รหัสแนะนำตามชีต|
|MC8|@591aetcq|[L68](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L68)|https://app.nsx999.com/aff/aff1688727|https://nsx999.run/|https://nsx999.pw/|สมัคร|
|MC8|@591aetcq|[P68](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=P68)|https://app.nsx999.com/|https://nsx999.run/|https://nsx999.pw/|ทางเข้า|
|UR9|@ur9sv1|[N71](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N71)|https://app.urus99.com/login|https://app.urus99.com/register/aff1688640|—|ชื่อ ทางเข้าเล่น ชี้ไปหน้าสมัคร; มีลิงก์ login อยู่รายการอื่นของห้อง แต่รายการนี้ต่างกัน|
|PS8|@3xslotfree|[D93](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=D93)|https://porsche88.pw/|https://porsche88.me/|—|หน้าเข้าเล่นหลัก|
|PS8|@3xslotfree|[P93](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=P93)|https://app.3xslot.com/login|https://porsche88.me/|https://porsche88.me/|ทางเข้าเก่า; สำรองซ้ำกับหลัก ไม่ใช่ปลายทางสำรองคนละตัว|
|FR8|@fr8sv|[P95](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=P95)|https://app2.123betv2.vip/?ref=c8affrg7nd&openExternalBrowser=1|https://app2.123betv2.vip/?openExternalBrowser=1|—|รายการสมัครในระบบไม่มี ref=c8affrg7nd|
|FR8|@fr8sv1|[N96](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N96)|http://line.me/ti/p/@fr8cash_1|https://lin.ee/pPPkFUD|—|รูปแบบ URL ต่างกัน ยังไม่ได้คลี่ลิงก์สั้น จึงยังไม่ยืนยันว่าปลายทางคนละ LINE|
|FR8|@350ajvsy|[N100](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N100)|https://app.123beginsignin.me/|https://123faz.center/|—|ไม่พบทางเข้าเล่นชื่อนี้; หน้าเข้าเล่นหลักใช้ 123faz.center ส่วนรายการสมัครใช้ app.123beginsignin.me/?ref=FAZ1776972|
|FR8|@u88x|[L107](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L107)|https://app.u888x.online/?ref=qs89pjc81q|https://app.u888x.online/|—|ระบบพบเพียงหน้าเข้าเล่นหลัก ไม่พบรายการสมัครพร้อม ref ตามชีต|
|FR8|@omg3x|[D109](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=D109)|https://app.omg369.xyz/login?|https://app2.123betv2.vip/|—|หน้าเข้าเล่นหลัก|
|FR8|@omg3x|[R109](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=R109)|https://app.omg369.xyz/login?openExternalBrowser=1|https://app2.123betv2.vip/|—|ทางเข้าเล่น|
|FR8|@ferrari88|[L111](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L111), [N111](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N111)|https://app.123betv2.vip/?ref=zb575rbwsx&openExternalBrowser=1|https://app2.123betv2.vip/?ref=zb575rbwsx&openExternalBrowser=1|—|ต่างเฉพาะ host app กับ app2; ref เหมือนกัน|
|SK8|@igoal123af|[R149](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=R149)|https://app.skol888.cc/|https://app1.skol888.cc/|—|รายการ ทางเข้า ต่างที่ app กับ app1|
|SK8|@igoal123free|[R156](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=R156)|http://line.me/ti/p/@skol888sv2|http://line.me/ti/p/@skol888sv|—|ไม่พบชื่อ ไลน์ ตรงตัว; ไลน์ SV ในระบบเป็น skol888sv และมี ไลน์ บอทตอบ เป็น URL หลังบ้าน manager.line.biz/account/@774idjjy ต้องยืนยันบทบาทก่อนแก้|
|7M|@7mnew|[D160](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=D160), [N160](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=N160), [P160](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=P160)|https://aff.ufabet7m.now/phoneregis.php?invitekey=8b3037831f4cbf2421fdaf1e9b618b11&openExternalBrowser=1|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|—|โดเมนต่างกัน และ invitekey ในระบบว่าง|
|7M|@7msport|[L169](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L169)|https://cutt.ly/Vr2zzSHP|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|—|URL สั้นต่างจาก URL ตรง ยังไม่ได้คลี่ redirect|
|7M|@7mpro|[D171](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=D171)|https://aff.ufabet7m.casa|https://member.ufabet7m.now/|—|หน้าเข้าเล่นหลักต่างกัน; ระบบมีรายการสมัครแยกเป็น /phoneregis.php?invitekey= ไม่ใช่ URL root ในชีต|
|7M|@u345x|[L172](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L172)|https://cutt.ly/Vr2zzSHP|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|—|URL สั้นต่างจาก URL ตรง ยังไม่ได้คลี่ redirect|
|7M|@025tdsnf|[L174](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=L174)|https://cutt.ly/Vr2zzSHP|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|—|URL สั้นต่างจาก URL ตรง ยังไม่ได้คลี่ redirect|

## ชื่อห้องต่างกัน: แยกจากลิงก์ผิด

|บริษัท|ชีต|ระบบ|ช่อง|ผลตรวจ|
|---|---|---|---|---|
|FR8|@123fzb|@123fzx|D99,L99,N99|พบ URL หลักและ URL สมัครพร้อม ref เหมือนกันในห้อง @123fzx ต้องยืนยันว่าเปลี่ยนชื่อห้องหรือเป็นคนละห้อง|
|7M|@u7mv1|@u7mvip|D157,L157,N157,P157,R157|URL ทั้ง 5 ช่องพบในห้อง @u7mvip; หน้าเว็บมีสำรอง https://ufabet7m.live/ ต้องยืนยันชื่อห้องก่อนย้ายหรือแก้|

## ตรวจสำรองและรายการเก่าจากฝั่งระบบเพิ่มเติม

1. **3XB @audi333 — สมัคร 2:** หลัก https://3xbet.money/aff/aff1932834 ต่างจากชีต แต่สำรอง https://3xbet.services/aff/aff1932834 ตรงกับ N23 ในชีต และระบบยังมีรายการ “สมัคร” ใช้ URL services เดียวกันอยู่แล้ว จึงไม่ควรสรุปว่าห้องนี้ไม่มีลิงก์ปัจจุบัน
2. **MC8 @mcc888 — สมัคร:** ระบบยังมีรายการเก่า https://app.mcc888.com/aff/aff1688152 โดยสำรอง https://mcc888.pw ตรงกับ URL ทางเข้าในชีต แต่ไม่ใช่ URL สมัครเต็มที่มี /aff/aff1688152 ระบบมีรายการสมัครใหม่ https://mcc888.pw/aff/aff1688152 แยกอยู่อีกตัว จึงควรทบทวนรายการเก่าก่อนลบหรือรวม
3. **MC8 กลุ่ม nsx999.run:** สำรองที่ระบบแสดงเป็น https://nsx999.pw/ ซึ่งยังไม่ตรงกับ app.nsx999.com และลิงก์สมัคร /aff/aff1688727 ในชีตตามตาราง ไม่ควรถือว่า “มีสำรองจึงตรงแล้ว”
4. **PS8 @3xslotfree — ทางเข้าเก่า:** สำรองและหลักเป็น https://porsche88.me/ เหมือนกัน
5. **FR8 @fr8sv1:** ระบบมีรายการ “แชร์ลิ้งค์รับทรัพย์” https://vimeo.com/983720315 เพิ่มจาก URL columns ของแถว 96 ไม่ได้สรุปว่าเป็นรายการผิด แต่อาจเป็นข้อมูลที่ยังไม่ได้ลงชีต
6. ช่อง F (ลิงก์สำรอง) ของ 174 แถวที่อ่านเป็นค่าว่างทั้งหมด จึงอ้างอิงสำรองจากหน้า DomainWatch ไม่ได้จากชีต

## ข้อมูลในชีตเองที่ควรระวัง

พบข้อความริชเมนูที่มี hyperlink ฝังไว้ไม่ตรงกับ URL ในช่องข้างกัน 64 ตำแหน่ง (เปรียบเทียบข้อความ URL หลังตัดช่องว่าง) บางรายการเป็นลิงก์หลังบ้าน LINE เทียบกับลิงก์ลูกค้า จึงไม่ใช่ข้อผิดพลาดทั้งหมด รายงานหลักข้างต้นยึด URL columns ตามหัวตาราง ไม่ได้ยึดลิงก์ที่ฝังในชื่อริชเมนู

ตัวอย่าง O3 ฝัง https://3xbet.services/ แต่ P3 เขียน https://3xbet.services/aff/aff19328344 — ควรยืนยันทั้งประเภทเมนูและรหัสแนะนำก่อนนำเข้า

|ช่องชื่อริชเมนู|ชื่อ|hyperlink ที่ฝัง|ช่อง URL|ค่า URL|
|---|---|---|---|---|
|[O3](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O3)|ทางเข้า|https://3xbet.services/|P3|https://3xbet.services/aff/aff19328344|
|[M14](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M14)|ทางเข้า|https://3xbet.services/|N14|https://3xbet.services/aff/aff27966|
|[M15](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M15)|สมัคร|https://3xbet.services/aff/aff27966|N15|https://3xbet.services/aff/aff2025476|
|[M23](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M23)|สมัคร|https://3xbet.money/aff/aff1932834|N23|https://3xbet.services/aff/aff1932834|
|[M24](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M24)|สมัคร|https://3xbet.services/aff/aff1932834|N24|https://3xbet.money/aff/aff1932834|
|[S30](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=S30)|ติดต่อเทเรแกรม|https://t.me/official3xbets|T30|https://t.me/mclaren9_official|
|[Q35](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q35)|ไลน์หลัก|https://manager.line.biz/account/@867uxlng|R35|http://line.me/ti/p/@mr9sv2|
|[Q36](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q36)|ไลน์หลัก|https://manager.line.biz/account/@867uxlng|R36|http://line.me/ti/p/@mr9sv2|
|[Q37](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q37)|ไลน์หลัก|https://manager.line.biz/account/@867uxlng|R37|http://line.me/ti/p/@mr9sv2|
|[Q38](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q38)|ไลน์หลัก|https://manager.line.biz/account/@867uxlng|R38|http://line.me/ti/p/@mr9sv2|
|[O40](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O40)|ไลน์หลัก|https://manager.line.biz/account/@867uxlng|P40|http://line.me/ti/p/@mr9sv2|
|[Q40](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q40)|ไลน์หลัก|https://manager.line.biz/account/@867uxlng|R40|http://line.me/ti/p/@mr9sv2|
|[Q41](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q41)|แจ้งปัญหาการเงิน|https://manager.line.biz/account/@867uxlng|R41|http://line.me/ti/p/@mr9support |
|[Q42](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q42)|แจ้งปัญหาการเงิน|https://manager.line.biz/account/@867uxlng|R42|http://line.me/ti/p/@mr9support |
|[M46](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M46)|ทางเข้า|https://mcc888.pw/|N46|https://mcc888.pw/aff/aff16881522|
|[K51](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K51)|สมัคร|https://mcc888.info/aff/aff1688152|L51|https://mcc888.pw/aff/aff1688152|
|[M51](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M51)|สมัคร|https://mcc888.info/aff/aff1688152|N51|https://mcc888.pw/aff/aff1688152|
|[M53](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M53)|การเงิน|http://line.me/ti/p/@mc8cash1|N53|https://app.mcc888.com/aff/aff1688152|
|[K55](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K55)|ทัวนาเมนต์|https://nsx999.run/tournament|L55|https://nsx999.pw/tournament|
|[Q55](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q55)|ทางเข้า |https://app.nsx999.com/|R55|https://nsx999.pw/|
|[O56](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O56)|SV|http://line.me/ti/p/@nx9sv|P56|http://line.me/ti/p/@nx9svv|
|[Q56](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q56)|ทางเข้า |https://app.nsx999.com/|R56|https://mcc888.pw/|
|[Q57](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q57)|ทางเข้า |https://app.nsx999.com/|R57|https://mcc888.pw/|
|[U58](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=U58)|ทางเข้า |https://mcc888.pw/|V58|https://mcc888.pw/https://mcc888.pw/|
|[K59](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K59)|สมัคร|https://app.mcc888.com/aff/aff1688152|L59|https://app.nsx999.com/aff/aff1688727|
|[O61](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O61)|ทางเข้า|https://mcc888.pw/|P61|https://app.3xfaz.com/|
|[M71](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M71)|ทางเข้าเล่น|https://app.urus99.com/register/aff1688640|N71|https://app.urus99.com/login|
|[O74](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O74)|ทางเข้าเล่น urus9|https://app.urus99.com/|P74|https://app.urus99.com/register/aff16886400|
|[M75](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M75)|ทางเข้าเล่น urus9|https://app.urus99.com/|N75|https://app.urus99.com/login|
|[M76](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M76)|ทางเข้าเล่น urus9|https://app.urus99.com/|N76|https://app.urus99.com/loginn|
|[M87](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M87)|ทางเข้า|https://app.porsche88.com/login|N87|https://porsche88.pw/|
|[Q91](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q91)|ไลน์การเงิน|http://line.me/ti/p/@ps8cash|R91|http://line.me/ti/p/@porsche88cash|
|[Q92](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q92)|ไลน์หลัก|http://line.me/ti/p/@porsche88|R92|http://line.me/ti/p/@porsche88cash|
|[K96](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K96)|ทางเข้าเล่น|https://app.123betv2.vip/|L96|https://app2.123betv2.vip/|
|[K100](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K100)|สมัครสมาชิก|https://app.123fazlogin.com/?ref=FAZ1776972|L100|https://app.123beginsignin.me/?ref=FAZ1776972|
|[M100](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M100)|ทางเข้าเล่น|https://123faz.center/|N100|https://app.123beginsignin.me/|
|[K102](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K102)|สมัคร|https://app.pgslot.gmbh/?ref=nxcxp96s22&openExternalBrowser=1|L102|https://app.pgplaygames.com?ref=nxcxp96s22|
|[M102](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M102)|ทางเข้า|https://app.pgslot.gmbh/|N102|https://app.pgplaygames.com/|
|[O102](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O102)|ฝาก - ถอน|https://app.pgslot.gmbh/|P102|https://app.pgplaygames.com/|
|[M105](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M105)|สมัคร|https://dk7.network/|N105|https://dk7.art/|
|[K107](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K107)|สมัครสมาชิก|https://app.ufa888.dev/|L107|https://app.u888x.online/?ref=qs89pjc81q|
|[M107](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M107)|เข้าสู่ระบบ|https://app.ufa888.dev/|N107|https://app.u888x.online|
|[O107](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O107)|ฝาก-ถอน|https://app.ufa888.dev/|P107|https://app.u888x.online|
|[K112](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K112)|สมัคร|https://app.123betv2.vip/?ref=zb575rbwsx&openExternalBrowser=1|L112|https://app2.123betv2.vip/?ref=zb575rbwsx&openExternalBrowser=1|
|[Q134](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q134)|แจ้งปัญหาบอทตอบ|http://line.me/ti/p/@fr8sv4|R134|http://line.me/ti/p/@ferrari8sv3|
|[K149](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K149)|ทางเข้า|https://app.skol888.cc/|L149|https://app1.skol888.cc/|
|[U149](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=U149)|ไลน์บริการ|http://line.me/ti/p/@skol888|V149|http://line.me/ti/p/@skol888svv|
|[O151](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O151)|ทางเข้า|https://app.skol888.cc/|P151|https://app1.skol888.cc/|
|[Q151](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q151)|ทางเข้า|https://app.skol888.cc/|R151|https://app1.skol888.cc/|
|[K153](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K153)|สมัคร|https://aff.skol88.cc/aff/16x81nvvtg|L153|https://aff.skol888.cc/?ref=igoal|
|[M153](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M153)|สมัคร|https://aff.skol88.cc/aff/16x81nvvtg|N153|https://aff.skol888.cc/?ref=igoal|
|[Q153](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q153)|ทางเข้า|https://app.skol888.cc/|R153|https://app1.skol888.cc/|
|[K154](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K154)|สมัคร|https://aff.skol88.cc/aff/16x81nvvtg|L154|https://aff.skol888.cc/?ref=igoal|
|[M154](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=M154)|สมัคร|https://aff.skol88.cc/aff/16x81nvvtg|N154|https://aff.skol888.cc/?ref=igoal|
|[Q154](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=Q154)|ทางเข้า|https://app.skol888.cc/|R154|https://app1.skol888.cc|
|[U154](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=U154)|ทางเข้า|https://app.skol888.cc/|V154|https://app1.skol888.cc|
|[O156](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=O156)|ทางเข้า|https://app.skol888.cc/|P156|https://app1.skol888.cc/|
|[K157](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K157)|สมัคร|https://aff.ufabet7m.now/phoneregis.php?invitekey=|L157|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|
|[K160](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K160)|สมัคร|https://aff.ufabet7m.now/phoneregis.php?invitekey=8b3037831f4cbf2421fdaf1e9b618b11&openExternalBrowser=1|L160|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|
|[K166](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K166)|สมัคร|https://aff.ufabet7m.now/phoneregis.php?invitekey=|L166|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|
|[K167](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K167)|สมัคร|https://aff.ufabet7m.now/phoneregis.php?invitekey=|L167|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|
|[K168](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K168)|สมัคร|https://aff.ufabet7m.now/phoneregis.php?invitekey=|L168|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|
|[K170](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K170)|สมัคร|https://aff.ufabet7m.now/phoneregis.php?invitekey=|L170|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|
|[K171](https://docs.google.com/spreadsheets/d/1G9pwTeUGcdwzdU2EBHjH2pft3GgDghFMNPQrPSJs7-Y/edit#gid=1964999726&range=K171)|สมัคร|https://aff.ufabet7m.now/phoneregis.php?invitekey=|L171|https://aff.ufabet7m.casa/phoneregis.php?invitekey=|

## ข้อเสนอแนะก่อนแก้ข้อมูล

ตรวจ URL ต่อซ้ำที่ MC8 ก่อน ตามด้วยรหัสแนะนำ FR8/3XB/7M และคู่ชื่อห้องที่ต่างกัน ให้เจ้าของข้อมูลยืนยันว่าจะยึดชีตหรือระบบแต่ละรายการ โดยเฉพาะลิงก์สั้นยังบอกไม่ได้ว่าปลายทางต่างกันจริง ห้ามแทนที่ข้อมูลทั้งชุดอัตโนมัติจากผลเปรียบเทียบนี้

