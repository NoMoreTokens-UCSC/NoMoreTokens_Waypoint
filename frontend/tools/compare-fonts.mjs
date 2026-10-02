import {chromium} from '@playwright/test'
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}})
for(const variant of ['opsz9','opsz14','auto']) {
 await page.goto('http://127.0.0.1:4175/design/7:23');await page.locator('[data-node="7:23"]').waitFor()
 const faces=variant==='legacy'? [400,500,700].map((weight,index)=>`@font-face{font-family:Candidate;src:url('/fonts/${['DMSans-Regular','DMSans-Medium','DMSans-Bold'][index]}.ttf');font-weight:${weight}}`).join('') : `@font-face{font-family:Candidate;src:url('/fonts/DMSans-variable.ttf');font-weight:100 1000}`
 await page.addStyleTag({content:faces+`[data-node]{font-family:Candidate!important;${variant==='legacy'?'':variant==='auto'?'font-optical-sizing:auto;':`font-optical-sizing:none;font-variation-settings:'opsz' ${variant==='opsz9'?9:14};`}}`})
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.images).map(img=>img.decode().catch(()=>{})))})
 await page.screenshot({path:`.figma-local/font-${variant}.png`})
}
await browser.close()
