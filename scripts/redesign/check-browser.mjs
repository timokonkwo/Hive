import fs from 'node:fs/promises';
const base = process.env.HIVE_CDP_URL || 'http://127.0.0.1:9350';
const site = process.env.HIVE_PREVIEW_URL || 'http://localhost:3100';
const output = process.env.HIVE_QA_DIR || '/private/tmp/hive-redesign-qa';
await fs.mkdir(output, { recursive: true });
const tab = await (await fetch(base + '/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let counter = 0;
const pending = new Map();
const errors = [];
ws.onmessage = e => { const v = JSON.parse(e.data); if (v.id) {
    const p = pending.get(v.id);
    if (p) {
        pending.delete(v.id);
        v.error ? p.reject(v.error) : p.resolve(v.result);
    }
}
else if (v.method === 'Runtime.exceptionThrown')
    errors.push(v.params.exceptionDetails); };
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++counter; const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timed out: ' + method)); }, 20000); pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } }); ws.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails)
    throw new Error(r.exceptionDetails.text); return r.result.value; };
const shot = async (name, full = false) => { const m = await send('Page.getLayoutMetrics'); const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: m.cssContentSize.width, height: m.cssContentSize.height, scale: 1 } } : {}) }); await fs.writeFile(output + '/' + name + '.png', Buffer.from(data.data, 'base64')); };
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass: !!pass, ...detail ? { detail } : {} }); if (!pass)
    console.error('FAIL: ' + name); };
const click = async (selector, index = 0) => { await evaluate(`document.querySelectorAll(${JSON.stringify(selector)})[${index}].scrollIntoView({block:'center',behavior:'instant'})`); await sleep(120); const p = await evaluate(`(()=>{const r=document.querySelectorAll(${JSON.stringify(selector)})[${index}].getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`); await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p }); await sleep(150); };
const key = async (key, code = key) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key === 'Enter' ? 13 : 27, ...(key === 'Enter' ? { text: '\r' } : {}) }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code }); };
await send('Page.enable');await send('Emulation.setFocusEmulationEnabled',{enabled:true});
await send('Runtime.enable');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: site + '/' });
await sleep(2200);
await evaluate("localStorage.setItem('hive-redesign-theme','dark');window.dispatchEvent(new Event('storage'))");
check('New supplied Hive wordmark used', await evaluate(`document.querySelectorAll('[data-hive-brand=wordmark]').length>=2&&!!document.querySelector('[data-hive-brand] [fill="#BEFF00"]')`));
check('Eight landing sections', await evaluate('document.querySelectorAll("main>section").length===8'));
check('Owner steps distinguish setup from agent work', await evaluate(`JSON.stringify([...document.querySelectorAll('#for-agent-owners h3')].map(e=>e.textContent))===JSON.stringify(['You list the agent','Your agent proposes','Your agent delivers'])`));
check('FAQ identifies who applies and delivers', await evaluate(`document.querySelector('[class*=questionList]').textContent.includes('AI agents submit proposals and deliver work. Owners list and configure their agents.')`));
check('Examples remain clearly labeled', await evaluate(`document.querySelector('[class*=artCaption]').textContent.includes('Example:')`));
check('Draft states it is not saved or posted', await evaluate(`document.querySelector('#task-brief').textContent.includes('This draft is not saved or posted.')`));
check('Removed repetitive and misleading landing instructions', await evaluate(`!/(apply for tasks|Select a role to change the example|Choose a type of work|Keep the requirements in view)/i.test(document.querySelector('main').innerText)`));

check('Primary landing actions open the app', await evaluate(`[...document.querySelectorAll('a')].filter(e=>e.textContent.trim()==='Launch App').length===3 && [...document.querySelectorAll('a')].filter(e=>e.textContent.trim()==='Launch App').every(e=>e.getAttribute('href')==='/marketplace')`));
check('Footer uses the accessible X icon', await evaluate(`!!document.querySelector('footer a[aria-label="Hive on X"] svg') && !document.querySelector('footer').innerText.includes('Follow Hive')`));
check('Heading lines and individual elements have reveal targets', await evaluate(`document.querySelectorAll('[data-reveal-line] [data-reveal-item]').length>=12 && document.querySelectorAll('[data-reveal-item]').length>=45`));
check('Section backgrounds stay visible before child reveals', await evaluate(`getComputedStyle(document.querySelector('#task-brief')).opacity==='1' && getComputedStyle(document.querySelector('#brief-heading [data-reveal-item]')).opacity==='0'`));
await evaluate(`document.querySelector('#task-brief').scrollIntoView({behavior:'instant',block:'start'})`);await sleep(180);
check('Heading text animates inside its line mask', await evaluate(`getComputedStyle(document.querySelector('#brief-heading [data-reveal-item]')).transform!=='none' && getComputedStyle(document.querySelector('#brief-heading [data-reveal-line]')).overflow==='clip'`));
await sleep(1000);
check('Text is fully visible after its reveal', await evaluate(`getComputedStyle(document.querySelector('#brief-heading [data-reveal-item]')).opacity==='1'`));

for (let i = 0; i < 4; i++) {
    await click('[aria-label="Explore agent roles"] button', i);
    check('Agent role ' + i, await evaluate(`document.querySelectorAll('[aria-label="Explore agent roles"] button')[${i}].getAttribute('aria-pressed')==='true' && document.querySelectorAll('[aria-controls="work-example"]')[${i}].getAttribute('aria-pressed')==='true'`));
}
for (let i = 0; i < 4; i++) {
    await click('[aria-controls="work-example"]', i);
    await sleep(350);
    check('Work example ' + i, await evaluate(`document.querySelectorAll('[aria-controls="work-example"]')[${i}].getAttribute('aria-pressed')==='true'`));
}
for (let i = 0; i < 3; i++) {
    await click('[aria-controls="guide-panel"]', i);
    await sleep(350);
    check('Guide stage ' + i, await evaluate(`document.querySelector('#guide-panel').innerText.includes('0${i + 1} / 03')`));
}
await click('[aria-label="Return to first step"]');
check('Guide replay', await evaluate("document.querySelector('#guide-panel').innerText.includes('01 / 03')"));
for (let i = 0; i < 3; i++) {
    await click('[aria-controls="agent-check"]', i);
    check('Comparison guide ' + i, await evaluate(`document.querySelector('#agent-check').innerText.includes('0${i + 1}')`));
}
await click('#brief-task');
await evaluate('document.querySelector("#brief-task").select()');
await send('Input.insertText', { text: 'Analyze weekly usage by token.' });
await click('#brief-requirements');
await evaluate('document.querySelector("#brief-requirements").select()');
await send('Input.insertText', { text: 'Include source links and a table.' });
await sleep(150);
check('Brief reflects typed input', await evaluate(`document.querySelector('#brief-copy').value.includes('Analyze weekly usage by token.')&&document.querySelector('#brief-copy').value.includes('Include source links and a table.')`));
await send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: site });
await click('form button[type="submit"]');
await sleep(100);
check('Copy brief', await evaluate("document.querySelector('[role=status]').innerText==='Brief copied.'"));
const text = await evaluate('navigator.clipboard.readText()');
check('Clipboard has the exact brief', text === await evaluate("document.querySelector('#brief-copy').value"));
await click('[class*="questionList"] summary', 0);
check('FAQ opens', await evaluate("document.querySelector('[class*=questionList] details').open"));
await evaluate("document.querySelector('[class*=questionList] summary').focus()");
await key('Enter');
check('FAQ keyboard closes', await evaluate("!document.querySelector('[class*=questionList] details').open"));
await click('[aria-label="Switch to light mode"]');
check('Light theme toggle', await evaluate("document.documentElement.dataset.hiveTheme==='light'"));
await send('Page.reload');
await sleep(1800);
check('Theme retained after reload', await evaluate("document.documentElement.dataset.hiveTheme==='light'"));
await evaluate("localStorage.removeItem('hive-redesign-theme');window.dispatchEvent(new Event('storage'))");
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await sleep(250);
check('Follows system dark mode', await evaluate("document.documentElement.dataset.hiveTheme==='dark'"));
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await sleep(250);
check('Follows system light mode', await evaluate("document.documentElement.dataset.hiveTheme==='light'"));
for (const theme of ['light', 'dark']) {
    await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');window.dispatchEvent(new Event('storage'))`);
    for (const width of [320, 375, 390, 768, 1280, 1440]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
        await sleep(160);
        const overflow = await evaluate('document.documentElement.scrollWidth>innerWidth');
        check(`${theme} ${width}px no page overflow`, !overflow);
    }
}
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await click('[class*="mobileMenu"] summary');
check('Mobile menu opens', await evaluate("document.querySelector('[class*=mobileMenu]').open"));
await key('Escape');
check('Escape closes and restores focus', await evaluate("!document.querySelector('[class*=mobileMenu]').open && document.activeElement.matches('summary')"));
await click('[class*="mobileMenu"] summary');
await click('[class*="mobileMotion"]');
check('Mobile motion control works', await evaluate("document.querySelector('[data-hive-site]').dataset.motionPaused==='true'"));
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await evaluate("window.scrollTo({top:0,behavior:'instant'})");
await sleep(350);
const sceneClip = await evaluate("(()=>{const r=document.querySelector('[class*=scene_]')?.getBoundingClientRect()||document.querySelector('[data-artwork]').getBoundingClientRect();return{x:Math.max(0,r.x),y:Math.max(0,r.y),width:r.width,height:r.height,scale:1}})()");
const frameA = await send('Page.captureScreenshot', { format: 'png', clip: sceneClip });
await sleep(600);
const frameB = await send('Page.captureScreenshot', { format: 'png', clip: sceneClip });
check('Pause freezes artwork', frameA.data === frameB.data);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: 'dark' }] });
await sleep(300);
check('Reduced motion stops transitions', await evaluate("getComputedStyle(document.querySelector('[aria-controls=work-example]')).transitionDuration==='0s'"));
check('Images are loaded', await evaluate("Array.from(document.querySelectorAll('img')).every(img=>img.complete && img.naturalWidth>0)"));
check('No forbidden landing wording', await evaluate("!/(settlement|live on robinhood|pulse|route ready|service selected)/i.test(document.querySelector('main').innerText)"));
check('No missing internal anchors', await evaluate("Array.from(document.querySelectorAll('a[href^=\"#\"]')).every(a=>document.getElementById(a.hash.slice(1)))"));
await evaluate("document.querySelector('header details').open=false");
for (const [theme, width] of [['light',1440],['dark',390]]) {
    await evaluate(`localStorage.setItem('hive-redesign-theme','${theme}');window.dispatchEvent(new Event('storage'))`);
    await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:width<600});
    await evaluate("scrollTo({top:0,behavior:'instant'})");
    await sleep(250);
    await shot('landing-copy-'+theme+'-'+width, true);
}
await evaluate("document.querySelector('[data-ready] canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");
await sleep(300);
check('WebGL loss reveals static fallback', await evaluate("document.querySelector('[data-ready]').dataset.ready==='false' && getComputedStyle(document.querySelector('[data-ready] [class*=sceneFallback]')).visibility==='visible'"));
check('No runtime exceptions', errors.length === 0, errors);
await fs.writeFile(output + '/interaction-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify({ passed: results.filter(x => x.pass).length, total: results.length, failures: results.filter(x => !x.pass) }, null, 2));
ws.close();
process.exitCode = results.some(result => !result.pass) ? 1 : 0;
