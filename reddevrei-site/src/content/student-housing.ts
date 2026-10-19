/**
 * The original reddevrei.com Student Housing page, transcribed on
 * 18 October 2026 with its renders and graphics (recovered to
 * /brand/original/). Two time-bound lines were left out: "Pre-leasing is
 * now open for the fall 2025 semester" and the 2025 referral window; see
 * docs/reddev-public-preview/original-site-audit.md.
 */

export type Picture = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

const o = (file: string, alt: string, width: number, height: number): Picture => ({
  src: `/brand/original/${file}`,
  alt,
  width,
  height,
});

export const studentHousing = {
  hero: {
    title: "Student Housing",
    subtitle:
      "High-quality, Affordable Student Accommodations in Edmonton, Alberta",
    cta: { label: "Book a Call", href: "/contact/?type=student-housing" },
  },
  mission: {
    title: "Mission Statement",
    body: "RedDev’s mission is to develop accessible and affordable purpose-built student housing that meets the growing demand for quality off-campus living. By strategically investing in high-growth university towns, we aim to provide students with safe, well-designed, and fully furnished housing solutions that ease financial burdens while fostering a sense of community. Our goal is to bridge the housing gap, ensuring students have access to comfortable and convenient accommodations that support their academic and personal success.",
    images: [
      o("student-housing-design-6.webp", "Rendering of a RedDev student multiplex exterior", 1594, 897),
      o("student-housing-design44.webp", "Rendering of a furnished student suite", 1800, 984),
    ],
  },
  demand: {
    title: "Market Demand",
    body: "Canada currently has over 2.2 million post-secondary students, yet there are only approximately 200,000 purpose-built student housing beds available nationwide. This massive shortfall forces the majority of students into expensive, inadequate, or highly competitive rental markets, driving up costs and reducing access to suitable housing. The demand for affordable, well-located student housing far outweighs the available supply, creating a critical need for purpose-built developments that cater specifically to student living. RedDev is committed to bridging this gap by delivering high-quality, accessible housing solutions that support students and the communities they live in.",
  },
  multiplex: {
    title: "MultiPlex Housing",
    body: "Whether you’re arriving from across the province or across the world, we understand what students and families need: safety, simplicity, and support. That’s why we’ve created a living experience that combines the privacy of a fully self-contained suite with the shared energy of a student-focused community. Every detail—right down to the modular furniture that transforms into a daytime workspace—has been curated with your success in mind.",
    subtitle: "MultiPlex Housing – Designed for International Success",
    detail:
      "For students, it’s a space to live independently without feeling alone. For parents, it’s peace of mind that your child is safe and supported. For academic recruiters, it’s a reliable, high-quality housing partner. And for investors, it’s a smart opportunity backed by a growing market, strong fundamentals, and responsible oversight. This is student living, reimagined.",
    image: o("mockup-of-a-lonely-magazine-lying-angled-on-a-transparent-surface-a14486.webp", "MultiPlex Housing brochure mockup", 1800, 1350),
    document: {
      label: "Download the MultiPlex Housing brochure",
      note: "PDF, 56 MB, 19 pages, hosted on reddevrei.com",
      href: "https://reddevrei.com/wp-content/uploads/2025/05/Multiplex-Housing-Email.pdf",
    },
  },
  projects: {
    title: "Current Projects",
    photo: o("homepage-walterdale-bridge.webp", "Walterdale Bridge, Edmonton", 1800, 1134),
    edmonton: {
      title: "Edmonton, Alberta",
      body: "RedDev is developing three modern student-focused multiplexes in Garneau, Edmonton, each with 8 fully furnished units featuring 3-4 bedrooms, private bathrooms, and shared living spaces. Located within walking distance of local universities, these affordable, high-quality buildings offer utilities, premium Wi-Fi, and flexible leasing. RedDev aims to set a new standard for off-campus living with sustainable housing solutions that benefit both students and the community.",
      image: o("chatgpt-image-apr-21-2025-01-14-37-pm.webp", "Rendering of the Garneau multiplex street frontage", 1510, 930),
    },
    units: {
      title: "24 Units – 84 Bedrooms",
      body: "Our 24 purpose-built student units offer private bedrooms with en-suite bathrooms, fully furnished living spaces, high-speed Wi-Fi, and study-friendly layouts. Designed for privacy and independence, while encouraging social connection through shared kitchen and living areas, these units provide a comfortable, affordable living experience. Located near the University of Alberta, our developments prioritize affordability, community, and a supportive environment for both academic success and personal growth.",
      map: o("oip.webp", "Map of the University of Alberta area", 474, 296),
    },
    distances: {
      title: "Distance to Local Universities",
      items: [
        "12 min walk to University of Alberta main campus",
        "6 min walk to Health Sciences/Jubilee LRT Station",
        "5 min walk to grocery store, pharmacy, and cafes",
        "3 min walk to bus stops with citywide connectivity",
        "Quiet residential street (105A Street) with local traffic only",
        "Surrounded by international food options, fitness centers, clinics, and public spaces",
      ],
    },
  },
  unitFeatures: {
    kicker: "Purpose built Student Housing",
    title: "Typical Unit Features",
    groups: [
      {
        title: "Eight Fully Furnished 3 & 4 Bedroom Units",
        items: [
          "Four Units with 4 x One-Bedroom Studio Suites",
          "Four Units with 3 x One-Bedroom Studio Suites",
        ],
      },
      {
        title: "All One-Bedroom Studio Suites with Private Bathrooms",
        items: ["Full-Sized Bedrooms: 28", "Full Ensuite Bathrooms: 28"],
      },
      {
        title: "Features",
        items: ["Flooring: Vinyl Plank", "Fully Finished, 9 ft. Basement Ceiling"],
      },
      {
        title: "Appliances",
        items: ["Included: Dryer, Refrigerator, Electric Stove, Washer"],
      },
      {
        title: "Cooling & Heating",
        items: ["Forced Air-1, Natural Gas"],
      },
    ],
    graphic: o("multiplex-housing-445.webp", "Unit layout graphic for the 8-unit multiplex", 1663, 1166),
  },
  floorPlans: {
    title: "Floor Plans",
    images: [
      o("student-housing-design-3.webp", "Floor plan rendering, main level", 1800, 1219),
      o("student-housing-design-4.webp", "Floor plan rendering, upper level", 1397, 1988),
      o("student-housing-design-2.webp", "Floor plan rendering, suite layout", 1800, 1012),
    ],
  },
  kitchen: {
    title: "Kitchen & Living Room",
    body: "Our shared kitchen and living room spaces are designed to foster a strong sense of community among student tenants. By encouraging daily interaction, shared meals, and casual conversations, these common areas help students build meaningful connections and create a supportive, social living environment. Outfitted with modern kitchen appliances and integrated grocery ordering through our platform, students can cook fresh, affordable meals with ease making food delivery apps virtually unnecessary. It’s a space that brings people together while promoting healthier, more convenient living.",
  },
  bedroom: {
    title: "Private Bedroom & Bathroom",
    images: [
      o("c4b6a5c4-364b-4366-b528-932e7c2e9077.webp", "Rendering of a private student bedroom", 1536, 1024),
      o("chatgpt-image-apr-14-2025-08-18-46-pm.webp", "Rendering of a furnished bedroom with desk", 1800, 1200),
      o("chatgpt-image-apr-21-2025-05-34-37-pm.webp", "Rendering of an ensuite bathroom", 1800, 1200),
      o("chatgpt-image-apr-21-2025-05-20-13-pm.webp", "Rendering of a bedroom with a fold-away bed", 1800, 1200),
    ],
  },
  furniture: {
    title: "Modular Furniture",
    body: "We are incorporating innovative modular and multifunctional furniture within our student units to optimize both available space and overall functionality. These versatile fold-away beds not only create more usable room during the day but also empower students to effortlessly reconfigure their living areas for various activities, whether it be studying, socializing, or unwinding. By skillfully integrating sleeping zones into the broader design aesthetic, Murphy beds provide an intelligent, space-efficient solution that significantly enhances comfort while maintaining a focus on style and practicality.",
  },
  portal: {
    title: "Tenant Portal",
    body: "The Multiplex Housing App is a mobile-first tenant portal designed for both international and domestic students. It offers smart door access, automated rent payments, maintenance tracking, ride booking, grocery ordering, and more—all in one place. With features like roommate matching, a shared calendar, and multilingual support, the app makes communication, scheduling, and daily living seamless and stress-free.",
    images: [
      o("student-housing-design-7.webp", "Multiplex Housing App screens", 1800, 1589),
      o("466b1fcb-08fa-4d94-a3d6-9b14a3ae4ba0.webp", "Student using the Multiplex Housing App", 1800, 1200),
    ],
  },
  amenities: {
    title: "Features & Amenities",
    body: "Off-campus rentals in Edmonton may seem cheaper, but they often come with hidden costs like furniture, utilities, internet, and long commutes costing students more than they anticipated. Our all-inclusive student housing removes the hassle by offering fully furnished private bedrooms with en-suite bathrooms, built-in closets, high-speed internet, and all utilities included. Each unit also features a furnished kitchen with modern appliances, grocery ordering through our platform, and a shared living room with a smart TV, making food delivery apps and extra expenses unnecessary. Just minutes from the University of Alberta, it’s a convenient, social, and cost-effective solution for student living.",
    images: [
      o("student-housing-design-367.webp", "Features and amenities graphic", 1563, 1869),
      o("student-housing-2.webp", "All-inclusive student housing graphic", 1232, 553),
    ],
  },
  infrastructure: {
    title: "Modern Infrastructure",
    blurbs: [
      {
        title: "Modern & Functional Design",
        body: "Our accommodations feature sleek, contemporary interiors with modular furniture, allowing students to customize their space for both studying and socializing. Each unit is fully furnished, eliminating the hassle of moving and furnishing an apartment, so students can settle in from day one.",
      },
      {
        title: "Smart Living with Property Tech",
        body: "We integrate Smart Technology solutions to enhance security, energy efficiency, and convenience. From keyless entry systems to smart thermostats and high-speed internet, our buildings cater to the tech-savvy lifestyle of today’s students.",
      },
      {
        title: "Turnkey Student Living",
        body: "With all-inclusive utilities, modern appliances, and well-designed communal spaces, our housing creates an environment where students can focus on their studies, connect with peers, and enjoy a balanced lifestyle. From private, furnished bedrooms with en-suite bathrooms to shared kitchens and living rooms with smart TVs, every detail supports both academic success and social well-being.",
      },
    ],
    images: [
      o("chatgpt-image-apr-14-2025-11-04-48-am.webp", "Rendering of a modern shared living room", 1800, 1200),
      o("chatgpt-image-apr-20-2025-11-16-58-am.webp", "Rendering of a smart-entry student building", 1800, 1200),
    ],
  },
  referral: {
    title: "Referral Program",
    body: "Spread the word and save! With our referral program, current tenants can earn $50 off their monthly rent for up to 6 months for every new tenant they bring in. Up to a maximum of 6 referrals. That’s up to $300 in rent savings, just for inviting your friends to live in the same community. If you’ve got friends looking for housing, why not live together and save? It’s the perfect way to enjoy student life with people you know while building a fun, connected living environment and getting rewarded for it.",
    image: o("student-housing-design-9.webp", "Students sharing a living space", 1800, 1197),
  },
  investing: {
    title: "Smart Housing, Smarter Investing",
    lead: "Student housing is one of the largest expenses in education but what if that expense could turn into a smart investment?",
    body: "Through our Limited Partnership (LP) structure, qualified investors can own a share of a purpose-built student housing asset just blocks from the University of Alberta. Our flagship project at 7318 105A Street NW features 28 private one-bedroom suites in a modern, fully furnished development located in Edmonton’s Queen Alexandra neighborhood. With demand for affordable student housing rising and a rent-control-free environment, this is a rare opportunity to earn consistent income and long-term appreciation.",
    whyTitle: "Why Invest?",
    why: [
      "Purpose-Built Student Housing with resilient demand",
      "Fully Leased Valuation: $4.5 Million (Newmark, 2025)",
      "Located in a rent-control-free jurisdiction with low vacancy rates (1.9% in the affordable tier)",
      "Alberta’s affordability and growth attract both the domestic and international student population",
      "Real Estate Ownership structure enables passive income with potential capital gains & tax efficiencies",
    ],
    cta: { label: "Investment information", href: "/edmonton-multiplex-lp-1/" },
  },
  leasing: {
    title: "Find Your Home Away from Home",
    body: "For more information about our units and pre-leasing availability, book a call to get all the details and secure your spot.",
    image: o("chatgpt-image-apr-14-2025-08-40-45-pm.webp", "Students arriving at their new home", 1800, 1200),
    cta: { label: "Book a Call", href: "/contact/?type=student-housing" },
  },
};
