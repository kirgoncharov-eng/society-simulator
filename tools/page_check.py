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

    await pg.click('label[for=spScene]')
    await pg.evaluate("() => { __lab().minute = 14 * 60 + 37; }")
    await pg.wait_for_function("() => document.getElementById('dayClock').textContent.startsWith('14:37')")
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
    await restored.wait_for_function("() => document.getElementById('dayClock').textContent.startsWith('14:37')")
    await restored.click('label[for=spCenturies]')
    assert await restored.evaluate('() => __lab().minute') == 877, 'Switching speed moved the saved clock'
    await restored.evaluate("""async () => {
        const expected = SIM.restore(window.labTestStartup);
        SIM.step(expected);
        await __labAdvance(1);
        if (SIM.serialize(__lab()) !== SIM.serialize(expected))
            throw Error('Midday startup changed the world at the next midnight');
    }""")
    await restored.close()
    print('Pause, one day, fork, and 14:37 save and speed switch passed')

async def check_clock_modes(pg, url, errs):
    fixture = await pg.evaluate("""() => {
        const world = SIM.newWorld(7012);
        world.minute = 1439;
        const adult = world.agents[0];
        const village = world.groups[0].id;
        function schedule(minute, text) {
            const event = { id: ++world.evId, t: 2, minute, type: 'rite', first: true, kind: 'wedding',
                text, who: [adult.id], gs: [village], x: adult.x, y: adult.y };
            world.events.unshift(event);
            const flash = world.flashId++;
            world.flashes.push({ ...event, id: flash });
            return { id: event.id, flash };
        }
        const late = schedule(1095, 'Испытание свадьбы в 18:15');
        const wedding = schedule(1080, 'Испытание свадьбы в 18:00');
        return { state: SIM.serialize(world), village, wedding, late };
    }""")
    async def open_at(state, mode, director=True):
        page = await pg.context.new_page()
        page.on('pageerror', lambda e: errs.append(str(e)))
        await page.emulate_media(reduced_motion='reduce')
        await page.add_init_script(f"""window.claude = {{ hot: {{ data: {{
            w: {json.dumps(state)}, mode: {json.dumps(mode)}, director: {json.dumps(director)}
        }} }} }};""")
        await page.goto(url)
        await page.click('#v2d')
        await page.uncheck('#stops')
        return page

    directed = await open_at(fixture['state'], 'centuries')
    await directed.click('[data-p=ctl]')
    await directed.locator(f"#groups [data-g='{fixture['village']}']").click()
    await directed.click('#cfollow')
    await directed.click('#play')
    await directed.wait_for_function("""() => {
        if (__lab().tick !== 1 || __labView().mode !== 'scene' || __lab().minute !== 1050) return false;
        document.getElementById('play').click();
        return true;
    }""")
    stamp = await directed.evaluate('() => [__lab().tick, __lab().minute]')
    assert stamp == [1, 1050], 'The director skipped the half-hour threshold'
    await directed.click('label[for=spDays]')
    assert await directed.evaluate('() => [__lab().tick, __lab().minute]') == stamp
    assert await directed.evaluate('() => __labView().mode') == 'days', 'Manual speed did not cancel the scene'
    await directed.wait_for_function('() => __labView().night === 0')
    snapshot = await directed.evaluate('() => SIM.serialize(__lab())')
    await directed.close()

    ordinary = await open_at(fixture['state'], 'centuries', False)
    await ordinary.evaluate("() => __labAdvance(1)")
    await ordinary.evaluate("minute => { __lab().minute = minute; }", stamp[1])
    assert await ordinary.evaluate('() => SIM.serialize(__lab())') == snapshot, 'Directing changed the world'
    await ordinary.close()

    scene = await open_at(snapshot, 'scene')
    event = scene.locator(f"#log [data-event='{fixture['wedding']['id']}']")
    await scene.evaluate("() => { __lab().minute = 1079; }")
    await scene.wait_for_function("() => document.getElementById('dayClock').textContent.startsWith('17:59')")
    assert await event.count() == 0
    assert fixture['wedding']['flash'] not in await scene.evaluate('() => __labView().flashes')
    await scene.evaluate("() => { __lab().minute = 1080; }")
    await event.wait_for(state='visible')
    assert await event.count() == 1
    assert fixture['wedding']['flash'] in await scene.evaluate('() => __labView().flashes')
    await scene.evaluate("() => { __lab().minute = 1095; }")
    late = scene.locator(f"#log [data-event='{fixture['late']['id']}']")
    await late.wait_for(state='visible')
    ordered = await scene.locator('#log [data-event]').evaluate_all("buttons => buttons.map(b => +b.dataset.event)")
    assert ordered.index(fixture['late']['id']) < ordered.index(fixture['wedding']['id'])
    after = await scene.evaluate('() => SIM.serialize(__lab())')
    await scene.close()

    loaded = await open_at(after, 'scene')
    await loaded.locator(f"#log [data-event='{fixture['wedding']['id']}']").wait_for(state='visible')
    assert fixture['wedding']['flash'] not in await loaded.evaluate('() => __labView().flashes')
    await loaded.close()
    print('Timed wedding, map flash, stable date and reload, and director at 17:30 passed')

async def main():
    os.makedirs(os.path.join(ROOT, 'tmp'), exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--disable-gpu-compositing', '--enable-unsafe-swiftshader'])
        bad = 0
        for w, h, name in [(1440, 900, 'desktop'), (390, 844, 'mobile')]:
            context = await b.new_context(viewport={'width': w, 'height': h})
            pg = await context.new_page()
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
            await pg.click('label[for=spCenturies]')
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
            print(name, f'Centuries: {after - before} simulated days, p95 UI timer interval {p95:.1f} ms')
            assert after - before > 120, 'Centuries did not advance the world'
            assert p95 < 100, f'Centuries blocked the UI thread: p95 {p95:.1f} ms'
            await check_world_controls(pg, url, errs)
            if name == 'desktop':
                await check_clock_modes(pg, url, errs)
            await pg.wait_for_timeout(800)
            await pg.screenshot(path=os.path.join(ROOT, 'tmp', f'{name}-map.png'))
            for tab in await pg.query_selector_all('[data-p]'):
                await tab.click(); await pg.wait_for_timeout(250)
            v3 = await pg.query_selector('#v3d')
            if v3:
                await v3.click(); await pg.wait_for_timeout(2500)
                await pg.screenshot(path=os.path.join(ROOT, 'tmp', f'{name}-3d.png'))
            print(name, 'errors:', errs[:5] or 'none'); bad += len(errs)
            await context.close()
        await b.close()
        sys.exit(1 if bad else 0)
asyncio.run(main())
