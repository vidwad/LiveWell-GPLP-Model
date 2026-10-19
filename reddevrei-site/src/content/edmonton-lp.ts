/**
 * The original reddevrei.com Edmonton Multiplex LP 1 page, transcribed on
 * 18 October 2026 with its graphics (recovered to /brand/original/) and
 * documents. The fundraising progress bars (28% of $2.5 million raised, 54%
 * indications of interest) were an undated snapshot and are not carried;
 * see docs/reddev-public-preview/original-site-audit.md. The FAQ lives in
 * ./edmonton-lp-faq.ts.
 */
import type { Picture } from "./student-housing";

const o = (file: string, alt: string, width: number, height: number): Picture => ({
  src: `/brand/original/${file}`,
  alt,
  width,
  height,
});

export const edmontonLp = {
  notice:
    "THIS CONTENT IS FOR INFORMATION PURPOSES ONLY. THIS IS NOT AN OFFERING MEMORANDUM OR PROSPECTUS AND SHOULD NOT BE TREATED AS OFFERING MATERIAL OF ANY SORT.",
  preliminary:
    "This preliminary information comprises only a summary of the terms of the proposed Edmonton MultiPlex Limited Partnership Units (the “LP Units”). The information herein is indicative only. Although the indicative information herein is reflective of the terms of the LP Units contemplated as of the time of this communication, there is no assurance that the LP Units will actually be issued. Before making any investment decision and entering into any transaction in relation to the LP Units, you should take steps to ensure that you understand the transaction and have made an independent assessment of the appropriateness of the transaction in the light of your own objectives. You should make sure that you have sufficient information available in relation to the Issuer before making an investment in the LP Units.",
  introduction: {
    title: "Introduction",
    paragraphs: [
      "Welcome to the Edmonton Multiplex Limited Partnership 1 (the “Partnership”), a unique investment opportunity in one of Canada’s fastest-growing university cities. This development is strategically located near the University of Alberta, a prime rental market catering to students and professionals alike. The Partnership offers investors the chance to be part of a high-demand, stable rental market, ensuring both consistent income and significant growth potential.",
      "The Partnership is set up to capitalize on investment prospects within Edmonton’s multi-family real estate market.",
      "The main goal of the Partnership is to acquire and enhance three properties in the Garneau neighborhood of Edmonton, close to the University of Alberta, where 8-Plex multi-family residential units will be built under the updated Zoning bylaws allowing for increased densification.",
      "These units are specifically designed to meet the high rental demand in the area and to provide a reliable source of rental income for investors.",
    ],
    eligibility: "Available to accredited investors only.",
  },
  documents: {
    indicationOfInterest: {
      label: "Indication of Interest form",
      note: "PDF, 130 KB, 1 page",
      href: "/documents/Indication-of-Interest-Edmonton-MultiPlex-LP-I.pdf",
    },
    corporateProfile: {
      label: "Corporate profile",
      note: "PDF, 4.8 MB, 11 pages",
      href: "/documents/RedDev-Real-Estate-Investments-Corporate-Profile.pdf",
    },
    educationCosts: {
      label: "Cover 100% of Your Child’s University Education Costs",
      note: "PDF, 119 KB, 2 pages",
      href: "/documents/Cover-100-of-Your-Childs-University-Education-Costs.pdf",
    },
    subcontractor: {
      label: "Sub-Contractor Partnership",
      note: "PDF, 27.8 MB, 13 pages, hosted on reddevrei.com",
      href: "https://reddevrei.com/wp-content/uploads/2024/10/RedDev-Real-Estate-Investments-SubContractor-Partnership.pdf",
    },
  },
  summary: {
    title: "Investment Summary",
    body: "This information is intended as a summary of certain information contained in the Edmonton MultiPlex Limited Partnership Agreement together with all attachments and/or supplements thereto from time to time (the “Offering Documents”). Any potential investor in the Units should review the Offering Documents in their entirety prior to making any investment decision with respect to this investment.",
    graphic: o("intro2.webp", "Edmonton Multiplex LP 1 investment summary graphic", 1800, 1340),
  },
  deal: {
    title: "The Deal",
    subtitle: "Offering Summary & Investment Returns",
    // The original site showed these as three small images (Spec-Graphic,
    // Spec-Graphic-1 and Proj-Returns, 158–313 px wide). They are rebuilt as
    // markup so they stay sharp at full width on phones; figures unchanged.
    stats: [
      { value: "3", label: "MultiPlex Buildings", tone: "red" },
      { value: "84", label: "Student Bedrooms", tone: "brown" },
    ] as const,
    projectedReturns: {
      title: "Projected Returns",
      rows: [
        { term: "Average annualized return on investment", value: "36%" },
        { term: "Average annualized distribution after year 1", value: "15%" },
        { term: "Equity multiplier", value: "3.2x" },
        { term: "Term", value: "5 year" },
      ],
    },
    gallery: [
      o("whatsapp-image-2024-05-29-at-14-43-55-5b04198b.webp", "Garneau site photograph", 1600, 1200),
      o("adobestock-385943993.webp", "Construction planning on site", 1800, 1200),
      o("prop-app.webp", "Property and tenant app graphic", 1160, 773),
      o("reddev-social-media-landing-page-1.webp", "Edmonton Student Housing LP 1 overview graphic", 1094, 626),
      o("reddev-social-media-landing-page-3.webp", "Edmonton Student Housing LP 1 highlights graphic", 808, 394),
      o("reddev-social-media-landing-page-4.webp", "Edmonton Student Housing LP 1 returns graphic", 488, 392),
    ],
  },
  project: {
    title: "Edmonton Multiplex",
    subtitle: "8 Unit Student Housing Developments",
    body: "Edmonton Multiplex LP is an 8-unit student housing development located within walking distance of the University of Alberta. The project is designed to provide modern, fully-furnished accommodations for students, featuring a mix of 3- and 4-bedroom units. Each bedroom is equipped with a private bathroom, offering tenants both privacy and convenience. In addition to spacious living areas and fully-equipped kitchens, tenants will enjoy access to premium services like secure parking, modular furniture, and modern amenities. This property is purpose-built for Edmonton’s growing student population, addressing the increasing demand for high-quality rental properties.",
    highlights: o("invest-highlihht.webp", "Project highlights graphic", 803, 746),
    problemSolution:
      "Canada’s student housing market is severely underserved, with demand quickly outpacing supply in metropolitan areas. As universities expand and international enrollments grow, the shortage of student housing highlights an urgent need for new development. RedDev Real Estate Investments is capitalizing on this opportunity by providing new developments designed specifically with students in mind, while delivering generous returns for our investors.",
    video: {
      label: "Edmonton day-to-night time-lapse",
      note: "MP4, 53 MB, hosted on reddevrei.com",
      href: "https://reddevrei.com/wp-content/uploads/2024/10/edmonton-city-day-to-night-time-lapse-2023-11-27-04-54-06-utc.mp4",
    },
  },
  whyEdmonton: {
    title: "Why Edmonton, Alberta",
    subtitle: "Top reasons to build & invest in Edmonton",
    items: [
      { term: "Population Growth", detail: "Significant growth projected, adding 175,000 people in the next three years. Continuous influx of students and professionals." },
      { term: "High Occupancy Rates", detail: "Consistent high demand for rental properties. Vacancy rate expected to drop to 1.7% by 2026. No maximum rent increase legislation." },
      { term: "Housing Affordability", detail: "Notably more affordable, with the May 2024 benchmark price for a single-family home at $465,900, significantly lower than Toronto, Vancouver, and Calgary." },
      { term: "Economic Stability", detail: "Diverse economy ensures resilience against sector-specific downturns, making it a prime location for multi-family developments." },
      { term: "Favorable Zoning", detail: "Support for higher-density developments, such as RF3 and RA7 zoning categories, facilitating multifamily unit construction." },
      { term: "Expanding Enrolment", detail: "The U of A aims to expand enrolment by more than 35% from 44,000 students now to 50,000 by 2026 and 60,000 within the next 10 years." },
    ],
  },
  cashFlow: {
    title: "Investor Cash Flow",
    subtitle: "Illustration based on a $100,000 investment",
    items: [
      { term: "Projected Return of Capital Upon Refinancing", detail: "Upon refinancing, 73% of the initial capital, or $73,200, is returned to investors." },
      { term: "Anticipated Cash Flow Distributions", detail: "Yearly cash flow anticipated: Year 1: $400, Year 2: $2,100, Year 3: $3,400, Year 4: $5,200, Year 5: $7,000." },
      { term: "Property Sale and Projected Profit", detail: "In Year 5, the sale of properties is expected to net $196,000 after mortgage repayment and the return of the remaining capital of $26,800 to investors." },
      { term: "Expected Returns", detail: "Total cash flow and profit amount expected to be $214,100, resulting in a strong annualized ROI of 36%." },
    ],
    caveat:
      "These figures are projections prepared by RedDev at the time of the original offering summary. They are not guarantees of income, return or timing; actual results will differ. Review the Offering Documents and consult your own advisers.",
    graphics: [
      o("cashflow-summary.webp", "Cash flow summary chart", 314, 278),
      o("projected-returns-on-100k.webp", "Projected returns on a $100,000 investment chart", 1088, 566),
    ],
  },
  terms: {
    title: "Financing Terms",
    body: "This information is intended as a summary of certain information contained in the Edmonton MultiPlex Limited Partnership Agreement together with all attachments and/or supplements thereto from time to time (the “Offering Documents”). Any potential Accredited Investor in the Units should review the Offering Documents in their entirety prior to making any investment decision with respect to this investment.",
    rows: [
      { term: "Name of Issuer", detail: "Edmonton MultiPlex Limited Partnership 1 (the “Partnership”), Vancouver, B.C., Canada" },
      { term: "Currently listed or quoted?", detail: "No. These securities do not trade on any exchange or market." },
      { term: "Reporting issuer?", detail: "No." },
      { term: "SEDAR filer?", detail: "No." },
      { term: "Securities Offered", detail: "Up to 2,600 Edmonton MultiPlex Limited Partnership Units (“LP Units”)" },
      { term: "Currency", detail: "Canadian Dollars (“CAD”), unless indicated otherwise." },
      { term: "Issue Price", detail: "The issue price will vary based on the three staged closings. First Closing: CAD $900 per LP Unit. Second Closing: CAD $1,000 per LP Unit. Third Closing: CAD $1,100 per LP Unit." },
      { term: "Minimum/Maximum Offering", detail: "There will be a minimum offering of 1,600 LP Units at a price of $900 each (CAD $1,440,000) and a maximum offering of 2,600 LP Units (CAD $2,730,000)." },
      { term: "Minimum Subscription", detail: "$50,000, with an incremental subscription of $1,000 thereafter. If you are not an individual and you are relying on the “minimum amount investment” exemption pursuant to NI 45-106, your minimum subscription amount is $150,000." },
      { term: "Use of Proceeds", detail: "Funds raised in the Offering will be used to acquire and develop real property investments in the Province of Alberta. This includes any real property, along with incidental personal property that may be used for management or operational purposes. Additionally, the Partnership may acquire and develop property in other locations as agreed upon by the Partners in a general meeting. (See “Summary Description of the Business”.)" },
      { term: "Resale Restrictions", detail: "You will be restricted from selling your LP Units for an indefinite period. There is no market for the LP Units." },
      { term: "Form of Offering", detail: "Private Placement offering, eligible for sale in all provinces and territories of Canada pursuant to National Instrument 45-106 – Prospectus and Registration Exemptions (“NI 45-106”)." },
      { term: "Selling Agent", detail: "The General Partner reserves the right to pay a Finder’s Fee in an amount of up to 8% of the gross proceeds of the Offering, provided that sales involving the payment of Finder’s Fees are conducted in accordance with NI 31-103." },
      { term: "Proposed Closing Date", detail: "One or more closing dates to be determined by the General Partner." },
    ],
  },
  moreInformation: {
    title: "More Information",
    images: [
      o("books-mockup-lying-on-a-white-surface-17401a.webp", "Investment summary document mockup", 1398, 1248),
      o("current-opportunity.webp", "Current opportunity one-page summary", 1414, 2000),
    ],
    packageRequest: {
      title: "Investor Package Request",
      body: "Request the full investor package, including the Offering Documents and investment summary, from the RedDev team.",
      cta: { label: "Request the investor package", href: "/contact/?type=investment" },
    },
  },
  presentation: {
    title: "Investor Presentation",
    body: "Everything you want to know about the Edmonton Multiplex Limited Partnership Offering. However, before making any investment decision and entering into any transaction in relation to the LP Units, please take steps to ensure that you understand the transaction and have made an independent assessment of the appropriateness of the transaction in the light of your own objectives.",
    embed: "https://www.canva.com/design/DAGIoZtMhEM/ZRvEYmiRUmJdOI9IM0zkfA/view?embed",
    link: "https://www.canva.com/design/DAGIoZtMhEM/ZRvEYmiRUmJdOI9IM0zkfA/view",
    linkLabel: "Edmonton MultiPlex LP 1 by Vid Wadhwani",
  },
  process: {
    title: "Step-by-Step Process",
    intro: "We understand that making an investment decision requires clarity and guidance. Here’s how easy it is to become a part of Edmonton Multiplex LP:",
    steps: [
      { title: "Register as an Investor", detail: "Begin by registering as an accredited investor with the RedDev team to gain access to all necessary documents and exclusive offers." },
      { title: "Review the Investment Documents", detail: "After registering, you will receive our comprehensive Offering Documents (“OD”). These outline all the key terms, financial projections, and detailed insights into the Edmonton Multiplex LP project." },
      { title: "Make Your Investment", detail: "Once you’ve reviewed the OD, you can proceed with your investment by following our straightforward process, where funds are transferred securely, and confirmation is sent upon completion." },
      { title: "Receive Regular Updates", detail: "Stay informed on the progress of your investment with quarterly updates from the RedDev Real Estate Investments team. These updates include construction milestones, financial performance, and market conditions that could affect the property’s value." },
      { title: "Start Receiving Income Distributions", detail: "Once the project is completed and tenants move in, you will start receiving regular income distributions from rental income, followed by the potential for substantial capital gains upon the sale or refinancing of the property." },
    ],
  },
  closing:
    "At RedDev REI, we create investment opportunities that go beyond the ordinary. Our Edmonton Multiplex Limited Partnership focuses on building a thriving community while delivering solid financial returns. Explore the potential of investing in quality student housing that meets the needs of today’s tenants. Join us in shaping the future of real estate in Edmonton.",
  team: {
    title: "Our Investment Team",
    intro:
      "Our team at RedDev REI is composed of experienced professionals dedicated to transforming the real estate landscape. Get to know the leaders who drive our vision and mission forward.",
  },
  education: {
    title: "Cover 100% of Your Child’s University Education Costs",
    body: "The Edmonton MultiPlex Limited Partnership (LP) is a unique investment designed to meet the growing demand for student housing near the University of Alberta. It offers an opportunity for parents of international students to offset the high costs of education through steady rental income and capital appreciation over a 5-year period.",
    image: o("title-page.webp", "Cover of the education-costs programme brochure", 1414, 2000),
  },
  subcontractors: {
    title: "Sub-Contractors: Maximize Your Contract Profits by Investing in What You Build",
    paragraphs: [
      "This way, you don’t just earn from your work—you also earn as an investor/owner in the same project.",
      "This strategy allows you to capitalize on your hard work while still getting paid for the services you provide. You’ll be in a position to triple your profit over the 5-year period of the LP investment, significantly increasing your total earnings compared to simply collecting your contract profit.",
    ],
    image: o("title-page-sub-contractos.webp", "Cover of the sub-contractor partnership brochure", 1414, 2000),
  },
};
