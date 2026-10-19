export default async function checkResponsiveHero(page) {
  const url = "https://8328-ix57i9a50cilr8el1o038-673069e2.us1.manus.computer/";
  const cases = [
    { name: "approved-desktop", width: 1440, height: 900, mobile: false },
    { name: "small-phone", width: 320, height: 568, mobile: true },
    { name: "standard-phone", width: 375, height: 667, mobile: true },
    { name: "tall-phone", width: 390, height: 844, mobile: true },
    { name: "large-phone", width: 430, height: 932, mobile: true },
  ];
  const results = [];

  for (const testCase of cases) {
    await page.setViewportSize({
      width: testCase.width,
      height: testCase.height,
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await document.querySelector(".hero-backdrop img").decode();
    });

    const layout = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        const box = element.getBoundingClientRect();
        return {
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          left: box.left,
          width: box.width,
          height: box.height,
        };
      };
      const copy = document.querySelector(".hero-copy");
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        hero: rect(".hero"),
        backdrop: rect(".hero-backdrop"),
        header: rect("header"),
        eyebrow: rect(".hero-eyebrow"),
        title: rect("#hero-title"),
        description: rect(".hero-description"),
        tagline: rect(".hero-bottom"),
        caption: rect(".hero-visual-note"),
        location: rect(".hero-location"),
        actions: [...document.querySelectorAll(".hero-actions a")].map(
          (element) => {
            const box = element.getBoundingClientRect();
            return {
              top: box.top,
              right: box.right,
              bottom: box.bottom,
              left: box.left,
              height: box.height,
            };
          },
        ),
        overlayCap: Number(
          getComputedStyle(document.querySelector(".hero-treatment")).opacity,
        ),
        horizontalOverflow:
          document.documentElement.scrollWidth > window.innerWidth + 1,
        copyOverflow: copy.scrollHeight > copy.clientHeight + 1,
      };
    });

    const issues = [];
    if (layout.horizontalOverflow) issues.push("Page has horizontal overflow");
    if (layout.overlayCap > 0.95) issues.push("Decorative overlay exceeds 95%");
    if (
      Math.abs(layout.backdrop.width - layout.hero.width) > 1 ||
      Math.abs(layout.backdrop.height - layout.hero.height) > 1
    )
      issues.push("Photo does not fill the hero");

    if (testCase.mobile) {
      if (Math.abs(layout.hero.height - layout.viewport.height) > 1)
        issues.push("Hero is not exactly one viewport tall");
      if (layout.copyOverflow)
        issues.push("Hero text area scrolls on a normal portrait phone");
      if (layout.eyebrow.top < layout.header.bottom - 1)
        issues.push("Hero text overlaps the fixed header");
      for (const [name, box] of Object.entries({
        title: layout.title,
        description: layout.description,
        tagline: layout.tagline,
        caption: layout.caption,
        location: layout.location,
      })) {
        if (
          box.top < layout.hero.top - 1 ||
          box.bottom > layout.hero.bottom + 1 ||
          box.left < -1 ||
          box.right > layout.viewport.width + 1
        )
          issues.push(`${name} is clipped outside the hero`);
      }
      for (const box of layout.actions) {
        if (box.bottom > layout.hero.bottom + 1 || box.height < 44)
          issues.push(
            "A hero action is clipped or below the mobile touch size",
          );
      }
      const toggle = page.locator(
        'header button[aria-controls="mobile-site-navigation"]',
      );
      await toggle.click();
      await page.waitForFunction(
        () =>
          document
            .querySelector(
              'header button[aria-controls="mobile-site-navigation"]',
            )
            .getAttribute("aria-expanded") === "true",
        null,
        { polling: 100, timeout: 5000 },
      );
      await page.waitForFunction(
        () => document.activeElement?.closest("#mobile-site-navigation"),
        null,
        { polling: 100, timeout: 5000 },
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () =>
          document
            .querySelector(
              'header button[aria-controls="mobile-site-navigation"]',
            )
            .getAttribute("aria-expanded") === "false",
        null,
        { polling: 100, timeout: 5000 },
      );
      await page.waitForFunction(
        () =>
          document.activeElement ===
          document.querySelector(
            'header button[aria-controls="mobile-site-navigation"]',
          ),
        null,
        { polling: 100, timeout: 5000 },
      );
      const focusRestored = await toggle.evaluate(
        (element) => document.activeElement === element,
      );
      if (!focusRestored)
        issues.push("Closing the mobile menu did not restore toggle focus");
    } else if (Math.abs(layout.hero.height - 755) > 1) {
      issues.push("Approved desktop hero height changed");
    }

    results.push({
      name: testCase.name,
      width: testCase.width,
      height: testCase.height,
      issues,
      layout,
    });
  }

  return {
    passed: results.every((result) => result.issues.length === 0),
    results,
  };
}
