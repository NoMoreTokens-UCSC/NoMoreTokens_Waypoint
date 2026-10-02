import {chromium} from '@playwright/test'
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844}})
page.on('pageerror', e=>console.log('PAGEERROR',e.message));page.on('console',msg=>{if(msg.type()==='error')console.log('CONSOLE',msg.text())})
await page.goto('http://127.0.0.1:4173/administration/team');await page.getByRole('button',{name:'Add user',exact:true}).waitFor({timeout:15000}).catch(e=>console.log(e.message));await browser.close()
