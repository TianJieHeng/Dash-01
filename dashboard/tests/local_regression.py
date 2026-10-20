#!/usr/bin/env python3
"""Local Chromium regression for the DASH-01 mock UI. Never use against live devices.

Requires Python Playwright and a locally installed Chromium. This runs locally,
not in CI, and only accepts loopback URLs. Reports and images go to diagnostics/.
"""
import argparse
import json
import re
from pathlib import Path
import shutil
import sys
import time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
ROUTES = ('home', 'calendar', 'tasks', 'shopping', 'photos', 'control', 'agents')
THEMES = ('mint', '01', '02', '03')
SIZES = ((1280, 800), (1600, 1000), (1920, 1080))

class Suite:
    def __init__(self, page, url, output):
        self.p, self.url, self.out = page, url, output
        self.results, self.errors, self.network = [], [], []
        page.on('pageerror', lambda err: self.errors.append(str(err)))
        page.on('requestfailed', lambda req: self.network.append({'url': req.url, 'failure': req.failure}))
        page.set_default_timeout(6000)

    def check(self, name, fn):
        start = time.monotonic()
        try:
            fn()
            self.results.append({'name': name, 'status': 'pass', 'seconds': round(time.monotonic()-start, 2)})
            print('PASS', name, flush=True)
        except Exception as err:
            self.results.append({'name': name, 'status': 'fail', 'error': str(err)})
            print('FAIL', name, str(err), flush=True)
            try:
                self.p.screenshot(path=str(self.out / ('failure-' + name.replace('/', '-') + '.png')))
            except Exception as capture_error:
                self.results[-1]['screenshot_error']=str(capture_error)

    def boot(self, route='home'):
        self.p.goto(self.url + '/#' + route, wait_until='domcontentloaded')
        expect(self.p.locator('#view-' + route)).to_have_class(re.compile(r'is-active'))
        self.p.wait_for_function('window.App && window.DATA && App.current')

    def route(self, name):
        self.p.locator('#rail [data-go="' + name + '"]').click()
        expect(self.p.locator('#view-' + name)).to_have_class(re.compile(r'is-active'))

    def theme(self, name):
        self.p.locator('.theme-choice[data-theme="' + name + '"]').click()
        expect(self.p.locator('html')).to_have_attribute('data-theme', name)

    def matrix(self):
        for width, height in SIZES:
            self.p.set_viewport_size({'width': width, 'height': height})
            self.boot()
            for theme in THEMES:
                self.theme(theme)
                for route in ROUTES:
                    def run(route=route, theme=theme, width=width, height=height):
                        self.route(route)
                        # Browser output, not generated/reference mockups. Fixed pause permits
                        # real transitions/images to settle; this is not a pixel-golden test.
                        self.p.wait_for_timeout(400)
                        metrics = self.p.evaluate('''() => {
                          const r=document.querySelector('#stage').getBoundingClientRect();
                          const v=document.querySelector('.view.is-active').getBoundingClientRect();
                          return {viewport:[innerWidth,innerHeight], stage:{x:r.x,y:r.y,w:r.width,h:r.height},
                            view:{x:v.x,y:v.y,w:v.width,h:v.height}, scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],
                            theme:document.documentElement.dataset.theme, route:App.current,
                            brokenImages:[...document.querySelectorAll('.view.is-active img')].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)};
                        }''')
                        r=metrics['stage']
                        assert r['x'] >= -1 and r['y'] >= -1, metrics
                        assert r['x']+r['w'] <= width+1 and r['y']+r['h'] <= height+1, metrics
                        assert metrics['scroll'][0] <= width+1 and metrics['scroll'][1] <= height+1, metrics
                        stem=f'{width}x{height}-{theme}-{route}'
                        (self.out/(stem+'.json')).write_text(json.dumps(metrics, indent=2)+'\n')
                        self.p.screenshot(path=str(self.out/(stem+'.png')))
                    self.check(f'{width}x{height}/{theme}/{route}', run)

    def calendar(self):
        self.boot('calendar')
        for mode in ('day', '3day', 'week', 'month'):
            btn=self.p.locator('#view-calendar button[data-mode="'+mode+'"]')
            btn.click(); expect(btn).to_have_class(re.compile(r'is-on'))
        self.p.locator('#view-calendar [data-add]').click()
        expect(self.p.locator('#sheetLayer')).to_have_class(re.compile('is-open'))
        self.p.locator('#sheetLayer #event-title').fill('Local QA event')
        self.p.locator('#sheetLayer [data-who="all"]').click()
        self.p.locator('#sheetLayer [data-save]').click()
        self.p.wait_for_function('DATA.events.some(e=>e.title==="Local QA event")')
        expect(self.p.locator('#sheetLayer')).not_to_have_class(re.compile('is-open'))
        self.p.reload(); self.p.wait_for_function('window.App && App.current')
        assert not self.p.evaluate('DATA.events.some(e=>e.title==="Local QA event")'), 'Demo event unexpectedly persisted'

    def chores(self):
        self.boot('tasks')
        self.p.locator('#view-tasks [data-r="after"]').click()
        cid=self.p.evaluate('DATA.chores.find(c=>c.r==="after" && c.who==="maya" && !c.done).id')
        stars=self.p.evaluate('DATA.stars.maya')
        self.p.locator('[data-ch="'+cid+'"]').click()
        self.p.wait_for_function('(id)=>DATA.chores.find(c=>c.id===id).done', arg=cid)
        self.p.locator('#view-tasks [data-undo]').click()
        assert self.p.evaluate('(id)=>!DATA.chores.find(c=>c.id===id).done', cid)
        assert self.p.evaluate('DATA.stars.maya')==stars
        anyid=self.p.evaluate('DATA.chores.find(c=>c.r==="after" && c.who==="any" && !c.done).id')
        self.p.locator('[data-ch="'+anyid+'"]').click()
        self.p.locator('#sheetLayer [data-by="maya"]').click()
        self.p.wait_for_function('(id)=>DATA.chores.find(c=>c.id===id).doneBy==="maya"', arg=anyid)
        self.p.locator('#view-tasks [data-undo]').click()
        assert self.p.evaluate('DATA.stars.maya')==stars
        for routine in ('morning','evening','after'):
            self.p.locator('#view-tasks [data-r="'+routine+'"]').click()

    def shopping(self):
        self.boot('shopping')
        gid=self.p.evaluate('DATA.groceries.find(g=>!g.done && g.qty===1).id')
        item=self.p.evaluate('(id)=>({...DATA.groceries.find(g=>g.id===id)})', gid)
        inc=self.p.locator('#view-shopping [data-qty="1"][data-id="'+gid+'"]')
        dec=self.p.locator('#view-shopping [data-qty="-1"][data-id="'+gid+'"]')
        expect(dec).to_be_disabled(); inc.click()
        assert self.p.evaluate('(id)=>DATA.groceries.find(g=>g.id===id).qty', gid)==2
        dec.click(); expect(dec).to_be_disabled()
        self.p.locator('#view-shopping [data-check="'+gid+'"]').click()
        self.p.wait_for_function('(id)=>DATA.groceries.find(g=>g.id===id).done', arg=gid)
        self.p.locator('#view-shopping [data-undo]').click()
        assert self.p.evaluate('(id)=>({...DATA.groceries.find(g=>g.id===id)})', gid)==item
        for store in ('grocer','costco','all'):
            self.p.locator('#view-shopping [data-store="'+store+'"]').click()
            ids=self.p.locator('#view-shopping .s-row').evaluate_all('(rows)=>rows.map(r=>r.dataset.id)')
            expected=self.p.evaluate('(s)=>DATA.groceries.filter(g=>!g.done&&(s==="all"||g.store===s)).map(g=>g.id)', store)
            assert sorted(ids)==sorted(expected)
        assert self.p.locator('#view-shopping .s-tile').count()==12
        field=self.p.locator('#view-shopping .s-input'); field.fill('a')
        assert self.p.locator('#view-shopping .s-ac-row').count()==5  # Suggestions are capped at five; custom add is separate.
        field.fill('Local QA item'); field.press('Enter')
        self.p.wait_for_function('DATA.groceries.some(g=>g.name==="Local QA item")')
        self.p.locator('#view-shopping [data-undo]').click()
        assert not self.p.evaluate('DATA.groceries.some(g=>g.name==="Local QA item")')

    def themes_preserve_state(self):
        self.boot('shopping')
        field=self.p.locator('#view-shopping .s-input'); field.fill('Draft remains')
        for theme in THEMES:
            self.theme(theme); expect(field).to_have_value('Draft remains')
        self.p.reload(); self.p.wait_for_function('window.App && App.current')
        expect(self.p.locator('html')).to_have_attribute('data-theme','03')
        self.theme('mint')

    def photos(self):
        self.boot('photos')
        for layout in ('auto','cover','pair','collage','polaroid'):
            btn=self.p.locator('#view-photos [data-layout="'+layout+'"]'); btn.click()
            expect(btn).to_have_class(re.compile('is-on'))
            expect(self.p.locator('#view-photos .slide').last).to_be_visible()
        self.p.locator('#view-photos [data-layout="pair"]').click()
        cycle=self.p.locator('#view-photos [data-cycle-photo]')
        cycle.press('Enter'); expect(cycle).to_be_focused()
        self.p.locator('#view-photos button[data-next]').last.click()
        self.p.locator('#view-photos button[data-prev]').last.click()
        self.p.locator('#view-photos [data-fav]').click()
        self.p.locator('#view-photos [data-loud]').click()
        expect(self.p.locator('#rail')).to_be_visible()

    def control(self):
        self.boot('control')
        expect(self.p.locator('#view-control .hc-demo')).to_have_text('DEMO · Simulated devices')
        initial=self.p.evaluate('DATA.climate.set')
        self.p.locator('#view-control [data-temp="0.5"]').click()
        expect(self.p.locator('#view-control [data-temp="0.5"]')).to_be_disabled()
        self.p.wait_for_function('(n)=>DATA.climate.set===n',arg=initial+0.5)
        self.p.locator('#view-control [data-temp="-0.5"]').click()
        self.p.wait_for_function('(n)=>DATA.climate.set===n',arg=initial)
        light=self.p.evaluate('DATA.devices.find(d=>d.type==="light"&&!d.flaky&&!d.offline).id')
        before=self.p.evaluate('(id)=>DATA.devices.find(d=>d.id===id).on',light)
        tile=self.p.locator('#view-control [data-dev="'+light+'"]')
        tile.locator('[data-toggle]').click()
        self.p.wait_for_function('([id,b])=>DATA.devices.find(d=>d.id===id).on!==b',arg=[light,before])
        tile.locator('[data-toggle]').click()
        self.p.wait_for_function('([id,b])=>DATA.devices.find(d=>d.id===id).on===b',arg=[light,before])
        # Native range keyboard input, not programmatic state mutation.
        tile.locator('[data-level]').press('Home')
        self.p.wait_for_function('(id)=>!DATA.devices.find(d=>d.id===id).on',arg=light)
        tile.locator('[data-level]').press('ArrowRight')
        self.p.wait_for_function('(id)=>DATA.devices.find(d=>d.id===id).level===1',arg=light)
        lock=self.p.evaluate('DATA.devices.find(d=>d.type==="lock"&&d.locked).id')
        lockbutton=self.p.locator('#view-control [data-dev="'+lock+'"] [data-lock]')
        lockbutton.click()
        assert self.p.evaluate('(id)=>DATA.devices.find(d=>d.id===id).locked',lock)
        lockbutton.press('Enter',delay=1100)
        self.p.wait_for_function('(id)=>!DATA.devices.find(d=>d.id===id).locked',arg=lock)
        lockbutton.click()
        self.p.wait_for_function('(id)=>DATA.devices.find(d=>d.id===id).locked',arg=lock)
        garage=self.p.evaluate('DATA.devices.find(d=>d.type==="garage").state')
        self.p.locator('#view-control [data-garage]').click()
        expect(self.p.locator('.slide-confirm')).to_be_visible()
        self.p.locator('#sheetLayer [data-close]').click()
        assert self.p.evaluate('DATA.devices.find(d=>d.type==="garage").state')==garage
        self.p.locator('#view-control [data-garage]').click()
        self.p.locator('.sc-knob').press('Enter',delay=1700)
        target='open' if garage=='closed' else 'closed'
        self.p.wait_for_function('(s)=>DATA.devices.find(d=>d.type==="garage").state===s',arg=target,timeout=10000)
        playing=self.p.evaluate('DATA.media.playing')
        self.p.locator('#view-control [data-play]').click()
        self.p.wait_for_function('(b)=>DATA.media.playing!==b',arg=playing)
        self.p.locator('#view-control [data-cam]').first.click()
        expect(self.p.locator('.cam-big')).to_be_visible()
        self.p.keyboard.press('Escape')
        expect(self.p.locator('#sheetLayer')).not_to_have_class(re.compile('is-open'))
        self.p.reload()  # Device commands are in-memory demo state only.

    def agents(self):
        self.boot('agents')
        assert self.p.locator('#view-agents').inner_text().strip()
        refresh=self.p.locator('#view-agents [data-refresh]')
        before=self.p.locator('#view-agents .ag-grid').inner_text()
        refresh.click()
        assert self.p.locator('#view-agents .ag-grid').inner_text()==before
        expect(self.p.locator('#view-agents .ag-announcement')).to_contain_text('unchanged')

    def interactions(self):
        self.p.set_viewport_size({'width':1280,'height':800})
        for name in ('themes_preserve_state','calendar','chores','shopping','photos','control','agents'):
            self.check(name, getattr(self,name))


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:4173')
    parser.add_argument('--chromium',default=shutil.which('chromium') or shutil.which('google-chrome'))
    parser.add_argument('--output',type=Path,default=ROOT/'diagnostics'/'local-dashboard-qa')
    mode=parser.add_mutually_exclusive_group()
    mode.add_argument('--matrix-only',action='store_true')
    mode.add_argument('--interactions-only',action='store_true')
    args=parser.parse_args()
    if urlparse(args.url).scheme != 'http' or urlparse(args.url).hostname not in ('localhost','127.0.0.1','::1'):
        parser.error('Only a local loopback mock dashboard is allowed.')
    args.output.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.chromium,headless=True)
        page=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
        suite=Suite(page,args.url.rstrip('/'),args.output)
        if not args.interactions_only: suite.matrix()
        if not args.matrix_only: suite.interactions()
        report={'scope':'Local desktop browser simulation only; NOT physical-frame or WebView 106 validation.',
                'results':suite.results,'page_errors':suite.errors,'request_failures':suite.network,
                'browser':browser.version,'url':args.url,'created_utc':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}
        (args.output/'report.json').write_text(json.dumps(report,indent=2)+'\n')
        browser.close()
        return 1 if suite.errors or any(r['status']=='fail' for r in suite.results) else 0

if __name__=='__main__':
    sys.exit(main())
