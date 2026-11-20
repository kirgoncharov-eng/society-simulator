# Browser check of the built page: opens dist/index.html headless, runs 40 years, switches tabs and 3D, reports JS errors.
# Needs: pip install playwright && playwright install chromium
# Usage: python3 tools/page_check.py   (screenshots go to tmp/)
import asyncio, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
async def main():
    os.makedirs(os.path.join(ROOT, 'tmp'), exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        bad = 0
        for w, h, name in [(1440, 900, 'desktop'), (390, 844, 'mobile')]:
            pg = await b.new_page(viewport={'width': w, 'height': h})
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + os.path.join(ROOT, 'dist', 'index.html')); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.getElementById('go').click()")
            await pg.evaluate("(()=>{const S=__lab(); for(let i=0;i<360*40;i++) SIM.step(S);})()")
            await pg.click('#play'); await pg.wait_for_timeout(800)
            await pg.screenshot(path=os.path.join(ROOT, 'tmp', f'{name}-map.png'))
            for tab in await pg.query_selector_all('[data-p]'):
                await tab.click(); await pg.wait_for_timeout(250)
            v3 = await pg.query_selector('#v3d')
            if v3:
                await v3.click(); await pg.wait_for_timeout(2500)
                await pg.screenshot(path=os.path.join(ROOT, 'tmp', f'{name}-3d.png'))
            print(name, 'errors:', errs[:5] or 'none'); bad += len(errs)
        await b.close()
        sys.exit(1 if bad else 0)
asyncio.run(main())
