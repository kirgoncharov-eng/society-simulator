# Browser check of the built page: opens dist/index.html headless, runs 40 years, switches tabs and 3D, reports JS errors.
# Needs: pip install playwright && playwright install chromium
# Usage: python3 tools/page_check.py   (screenshots go to tmp/)
import asyncio, json, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Make an in-flight reply arrive after pause. This exercises the real worker
# while avoiding a race between Playwright and a fast worker.
HOLD_REPLIES = """(() => {
    const BrowserWorker = window.Worker;
    window.labTestReplies = [];
    window.Worker = class extends BrowserWorker {
        set onmessage(callback) {
            super.onmessage = event => {
                if (window.labTestHold && event.data.snapshots)
                    window.labTestReplies.push(() => callback.call(this, event));
                else callback.call(this, event);
            };
        }
    };
})()"""

async def check_world_controls(pg, url, errs):
    await pg.evaluate("""async () => {
        const expected = SIM.restore(SIM.serialize(__lab()));
        window.labTestStep(expected);
        await __labAdvance(1);
        if (SIM.serialize(__lab()) !== SIM.serialize(expected))
            throw Error('Worker single step differs from the engine');
    }""")

    await pg.uncheck('#stops')
    await pg.evaluate("() => { window.labTestHold = true; }")
    paused_tick = await pg.evaluate("() => __lab().tick")
    await pg.click('#play')
    await pg.wait_for_function("() => window.labTestReplies.length > 0")
    await pg.click('#play')
    await pg.evaluate("""() => {
        window.labTestHold = false;
        for (const deliver of window.labTestReplies.splice(0)) deliver();
    }""")
    assert await pg.evaluate("() => __lab().tick") == paused_tick, 'Late worker reply advanced a paused world'

    saved = await pg.evaluate("() => SIM.serialize(__lab())")
    await pg.click('#fork')
    await pg.evaluate("() => __labAdvance(7)")
    await pg.uncheck('#fly')
    await pg.click('#back')
    await pg.evaluate("""async saved => {
        const expected = SIM.restore(saved);
        const current = JSON.parse(SIM.serialize(__lab()));
        const event = current.events.shift();
        if (event?.type !== 'fork' || event.t !== expected.tick)
            throw Error('Fork did not restore the saved day');
        current.evId--;
        if (JSON.stringify(current) !== SIM.serialize(expected))
            throw Error('Fork did not restore the saved world');
        expected.events.unshift(event);
        expected.evId++;
        window.labTestStep(expected);
        await __labAdvance(1);
        if (SIM.serialize(__lab()) !== SIM.serialize(expected))
            throw Error('Worker kept advancing from the world before the fork');
    }""", saved)

    restored = await pg.context.new_page()
    restored.on('pageerror', lambda e: errs.append(str(e)))
    await restored.add_init_script(f"""
        window.claude = {{ hot: {{
            data: {{ w: {json.dumps(saved)} }},
            snapshot(getSnapshot) {{ window.labTestStartup = getSnapshot().w; }}
        }} }};
    """)
    await restored.goto(url)
    assert await restored.evaluate("() => window.labTestStartup") == saved, 'Saved world did not survive startup'
    await restored.close()
    print('Pause, one day, fork, and saved world startup passed')

async def main():
    os.makedirs(os.path.join(ROOT, 'tmp'), exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--disable-gpu-compositing', '--enable-unsafe-swiftshader'])
        bad = 0
        for w, h, name in [(1440, 900, 'desktop'), (390, 844, 'mobile')]:
            pg = await b.new_page(viewport={'width': w, 'height': h})
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.emulate_media(reduced_motion='reduce')
            await pg.add_init_script(HOLD_REPLIES)
            url = 'file://' + os.path.join(ROOT, 'dist', 'index.html')
            await pg.goto(url); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.getElementById('go').click()")
            await pg.click('#v2d')
            # A worker must own the advancing world. Disable the UI's copy of step.
            await pg.evaluate("""() => {
                window.labTestStep = SIM.step;
                SIM.step = () => { throw Error('SIM.step on the UI thread'); };
            }""")
            await pg.evaluate("() => __labAdvance(360 * 40)")
            assert not await pg.evaluate("() => __v3().on"), '3D opened after switching to the map'
            await pg.click('label[for=sp64]')
            await pg.uncheck('#stops')
            before = await pg.evaluate("() => __lab().tick")
            await pg.locator('#play').click()
            gaps = await pg.evaluate("""() => new Promise(resolve => {
              const gaps = [], start = performance.now();
              let last = start;
              function sample() {
                const t = performance.now();
                gaps.push(t - last);
                last = t;
                if (t - start < 2000) setTimeout(sample, 25);
                else resolve(gaps.sort((a, b) => a - b));
              }
              setTimeout(sample, 25);
            })""")
            await pg.locator('#play').click()
            after = await pg.evaluate("() => __lab().tick")
            await pg.wait_for_timeout(150)
            assert await pg.evaluate("() => __lab().tick") == after, 'World advanced after pause'
            p95 = gaps[int(len(gaps) * 0.95)]
            print(name, f'64x: {after - before} simulated days, p95 UI timer interval {p95:.1f} ms')
            assert after - before > 120, '64x did not advance the world'
            assert p95 < 100, f'64x blocked the UI thread: p95 {p95:.1f} ms'
            await check_world_controls(pg, url, errs)
            await pg.wait_for_timeout(800)
            await pg.screenshot(path=os.path.join(ROOT, 'tmp', f'{name}-map.png'))
            for tab in await pg.query_selector_all('[data-p]'):
                await tab.click(); await pg.wait_for_timeout(250)
            v3 = await pg.query_selector('#v3d')
            if v3:
                await v3.click(); await pg.wait_for_timeout(2500)
                await pg.screenshot(path=os.path.join(ROOT, 'tmp', f'{name}-3d.png'))
            print(name, 'errors:', errs[:5] or 'none'); bad += len(errs)
            await pg.close()
        await b.close()
        sys.exit(1 if bad else 0)
asyncio.run(main())
