/**
 * Copy carried over from the original reddevrei.com pages (Home, About Us,
 * Invest), transcribed on 18 October 2026. See
 * docs/reddev-public-preview/original-site-audit.md for the page-by-page
 * audit and the handful of edits made (noted inline).
 */

export const homeCopy = {
  kicker: "HELPING YOU INVEST IN MULTIFAMILY REAL ESTATE",
  lead: "RedDev Real Estate Investments specializes in creating exceptional real estate investment opportunities through strategic syndication and development projects.",
  welcome: [
    "With a strong foundation built on decades of combined expertise in real estate, construction, and financial management, RedDev Real Estate Investments is dedicated to delivering sustainable growth and high returns for our investment partners. Whether you’re an experienced investor or new to real estate syndication, our comprehensive approach ensures that you have access to lucrative investment opportunities while being guided every step of the way.",
    "Explore how we work, learn about our projects, and join our exclusive community of accredited investors. RedDev is committed to helping you achieve your financial goals through smart, well-managed real estate investments.",
  ],
  approachIntro:
    "Our investment approach is rooted in a deep understanding of the real estate market and a commitment to thorough due diligence. We follow a systematic process to identify, acquire, enhance, and manage our investments, ensuring that we deliver superior returns for our investors while maintaining regular reporting and strong compliance with all relevant laws and regulations.",
  stageBlurbs: {
    Analyze:
      "We conduct market analysis and property due diligence to determine our strategy and forecast potential investments.",
    Acquire:
      "We negotiate with sellers and secure appropriate debt financing to complete the acquisition and conservatively enhance returns.",
    Enhance:
      "We renovate and execute management improvements that contribute to a higher NOI, resulting in an increased value.",
    Manage:
      "We manage the day-to-day operations of the properties, including property maintenance, leasing, and tenant relations.",
    "Report & Comply":
      "We provide regular performance reports and ensure that the investment is in compliance with all securities laws and regulations.",
  } as Record<string, string>,
  investLine:
    "RedDev invests alongside our partners to preserve wealth and secure financial freedom through cash-flowing multifamily real estate investments.",
  insightsIntro:
    "Get the latest news and essential information on the multifamily market, learn about the latest developments from RedDev Real Estate Investments, and arm yourself with the high-level data and fundamental insights behind every great investment choice.",
  syndicationGraphic: {
    src: "/brand/original/untitled-design.webp",
    alt: "RedDev syndication graphic from the original website",
    width: 524,
    height: 480,
  },
};

export const brochure = {
  title: "Corporate Brochure",
  blurb:
    "RedDev REI is a premier syndicator and vertically integrated owner and operator of multifamily apartments committed to delivering outstanding real estate investment opportunities for institutional and accredited investors.",
  href: "/documents/RedDev-Real-Estate-Investments-Corporate-Profile.pdf",
  label: "Download the corporate profile",
  note: "PDF, 4.8 MB, 11 pages",
  image: {
    src: "/brand/original/pair-of-flyers-template-lying-on-a-transparent-surface-a15048-1.webp",
    alt: "RedDev corporate brochure mockup",
    width: 1800,
    height: 1350,
  },
};

export const opportunity = {
  intro:
    "Explore our current investment offerings and discover how you can participate in high-potential real estate opportunities. Each offering is carefully selected and managed by our experienced team, providing a unique blend of potential for growth and income.",
  title: "Edmonton Multiplex Limited Partnership 1",
  location: "Edmonton, Alberta",
  paragraphs: [
    "The Edmonton MultiPlex Limited Partnership (the “Partnership”) is set up to capitalize on investment prospects within Edmonton’s multi-family real estate market.",
    "The main goal of the Partnership is to acquire and enhance three properties in the Garneau neighborhood of Edmonton, close to the University of Alberta, where 8-Plex multi-family residential units will be built under the updated Zoning bylaws allowing for increased densification.",
    // Original: "guaranteeing a reliable source of rental income". Softened to
    // "designed to provide"; the acknowledgement below carries the risk wording.
    "These units are specifically designed to meet the high rental demand in the area and to provide a reliable source of rental income for investors.",
  ],
  eligibility: "Available for accredited investors only.",
  href: "/edmonton-multiplex-lp-1/",
};

export const accreditedAcknowledgement = {
  title: "Accredited Investor Acknowledgement",
  paragraphs: [
    "Any investment or financial information presented here is based on current market conditions, projections, and assumptions, which may change. It is not exhaustive and should not be relied upon solely for investment decisions. Any information presented on this website does not constitute an offer to sell or a solicitation of an offer to buy any securities or to participate in any investment. The information is preliminary and subject to refinement.",
    "Investment in real estate, including the redevelopment of multi-family properties, involves significant risks such as market risk, construction risk, financing risk, and operational risk. Potential investors should consider these risks and their own risk tolerance before making any investment decisions. A detailed risk assessment will be provided in subsequent offering documents as part of the formal investment offering.",
  ],
  statement: "I hereby acknowledge that I am an Accredited Investor.",
  buttonLabel: "I Confirm I am an Accredited Investor",
  href: "/edmonton-multiplex-lp-1/",
};

export const aboutCopy = {
  company: [
    "At RedDev Real Estate Investments, we are dedicated to transforming the real estate landscape through innovative strategies and a commitment to excellence. With a focus on high-value investment opportunities, we specialize in identifying and developing properties that maximize returns while enhancing the communities we serve. Our expertise spans various real estate sectors, including residential, commercial, and mixed-use developments, ensuring that each project we undertake is built on a foundation of quality, integrity, and sustainable growth.",
    "Driven by a team of seasoned professionals with extensive industry experience, RedDev is at the forefront of real estate investment in the Edmonton area and beyond. Our approach combines market analysis, strategic planning, and hands-on project management to deliver results that exceed expectations. We take pride in adapting to the dynamic real estate market, leveraging new opportunities and mitigating risks to achieve optimal outcomes for our investors. At RedDev, we don’t just build properties—we build long-lasting partnerships based on trust, transparency, and shared success.",
  ],
  vision:
    "Our vision at RedDev Real Estate Investments is to be a leading real estate investment company, recognized for transforming communities through strategic property investments. We strive to create sustainable value for our investors, tenants, and the communities we serve, while setting new standards for excellence and innovation in the real estate industry.",
  mission:
    "Our mission at RedDev Real Estate Investments is to create exceptional real estate investment opportunities that enhance communities and enrich lives. We leverage our collective strengths, deep industry expertise, and strategic partnerships to deliver superior returns for our investors. Through rigorous due diligence, value-add strategies, and proactive property management, we aim to maximize the value of our investments while maintaining the highest standards of integrity and transparency.",
  valuesIntro:
    "At RedDev Real Estate Investments, our core values and principles guide every decision we make and form the foundation of our approach to real estate investment. These values reflect our commitment to excellence, integrity, and value creation, and they shape our relationships with our investors, partners, and the communities we serve.",
  teamIntro:
    "Our team at RedDev REI is composed of experienced professionals dedicated to transforming the real estate landscape. Get to know the leaders who drive our vision and mission forward.",
  logo: {
    src: "/brand/original/logo-full.webp",
    alt: "RedDev Real Estate Investments",
    width: 1800,
    height: 1060,
  },
};

export const investCopy = {
  nextSteps: [
    {
      number: "01",
      title: "Review & Due Diligence",
      description:
        "Review Packet: Understand the project by thoroughly reviewing all materials. Due Diligence: Review financials, market analysis, and legal documents; ask questions as needed.",
    },
    {
      number: "02",
      title: "Connect With Our Team",
      // The original card carried the heading only.
      description:
        "Speak with the RedDev team about the opportunity, your questions and the appropriate next step for your situation.",
    },
    {
      number: "03",
      title: "Commit To Invest",
      // The original card carried the heading only.
      description:
        "Complete the subscription documents with your professional advisers. Your investment is confirmed once the Partnership accepts your subscription.",
    },
  ],
  experience: {
    title: "Creating the Best Real Estate Investing Experience",
    lead: "Our goal is to get premium returns for our Canadian investors and help you build mega wealth.",
    body: "We provide first class service and make it super easy for you to invest in real estate. We are experts at finding great real estate opportunities and partnering with investors to raise capital. We then acquire, develop, optimize rental income, and ultimately sell to maximize investor returns at every stage.",
  },
  distributions: {
    title:
      "Our investors benefit from regular monthly distributions generated by our cash-flowing properties.",
    body: "At RedDev, we consistently strive to exceed expectations by targeting annual returns of 15-20%+, with the ambitious aim of reaching even higher. Our vision is to raise over $200 million in capital by 2030, empowering over 2000 real estate investors to invest in multifamily developments in Canada and the United States.",
    caveat:
      "Targets are objectives, not guarantees. Returns depend on each project’s performance and are described in its formal offering documents.",
    image: {
      src: "/brand/original/books-mockup-lying-on-a-white-surface-17401a.webp",
      alt: "RedDev investor materials",
      width: 1398,
      height: 1248,
    },
  },
  presentation: {
    title: "Investor Presentation",
    embed: "https://www.canva.com/design/DAGW2Tb0U8A/MxrMO7yOUgynXgNmKpINEA/view?embed",
    link: "https://www.canva.com/design/DAGW2Tb0U8A/MxrMO7yOUgynXgNmKpINEA/view",
  },
};
