export type TeamProfile = {
  name: string;
  role: string;
  bio: string[];
  email?: string;
  phone?: string;
  image?: string;
};

/**
 * Transcribed from RedDev's public About Us page. Personal contact details are
 * displayed only because they are published alongside the corresponding profile
 * on that source page; they should be reconfirmed before production release.
 */
export const teamProfiles: TeamProfile[] = [
  {
    name: "Vid Wadhwani",
    role: "Managing Partner & Executive Director",
    bio: [
      "Vid Wadhwani brings over 40 years of expertise in real estate investment, corporate finance, and capital markets to his role as Managing Partner at RedDev Real Estate Investments. His career spans foundational roles at several national investment firms including RBC Dominion Securities, BMO Nesbitt Thompson, and CM Oliver, where he developed a comprehensive understanding of investment strategies and client-focused growth. Vid’s depth of experience in structured finance and real estate transactions positions him as a trusted leader in advancing RedDev’s mission to create high-value investment opportunities.",
      "At RedDev, Vid combines his background in real estate with a strategic focus on addressing Canada’s housing supply challenges through multifamily developments. By leveraging his expertise in market analysis, regulatory compliance, and strategic planning, he leads RedDev in building transparent, data-driven investment opportunities that meet investor expectations and community needs alike.",
    ],
    email: "VidWadhwani@reddevrei.com",
    phone: "(604) 729-7077",
    image: "/brand/vid-wadhwani.png",
  },
  {
    name: "David Carkeek",
    role: "Partner & Executive Director",
    bio: [
      "David Carkeek, Partner at RedDev Real Estate Investments, has over 45 years of experience in finance, management, and real estate development. With a diverse career that includes co-founding a successful franchise chain and serving as COO of a publicly traded real estate company, Dave brings a wealth of knowledge in building and scaling real estate ventures. His financial expertise and strategic acumen make him an invaluable part of RedDev’s leadership.",
      "At RedDev, Dave focuses on financial structuring, capital management, and operational oversight. His involvement in RedDev’s project planning and execution reflects his commitment to delivering value to investors through well-managed, profitable real estate investments. With an eye on sustainable growth, Dave supports RedDev’s initiatives to enhance communities while generating reliable returns for stakeholders.",
    ],
    email: "davecarkeek@reddevrei.com",
    phone: "(604) 760-9212",
    image: "/brand/david-carkeek.png",
  },
  {
    name: "Mark Kauhane",
    role: "Partner & Executive Director",
    bio: [
      "Mark Kauhane, Partner at RedDev Real Estate Investments, brings a strategic perspective to the team, backed by years of experience in business management and international partnerships. With a proven track record of driving growth and creating value, Mark has worked with high-tech companies and global retailers, focusing on key performance metrics and bottom-line returns.",
      "At RedDev, Mark’s role centers on establishing and strengthening partnerships that support the company’s real estate projects. He is instrumental in negotiating agreements, building alliances, and optimizing project outcomes to ensure maximum value for investors. His dedication to quality and results-driven approach align with RedDev’s commitment to delivering exceptional real estate developments.",
    ],
    email: "markkauhane@reddevrei.com",
    phone: "(604) 614-7182",
    image: "/brand/mark-kauhane.png",
  },
  {
    name: "Nathan Wadhwani",
    role: "Partner & Executive Director",
    bio: [
      "Nathan Wadhwani is a Partner at RedDev Real Estate Investments, where he combines his background in corporate finance with a dedication to strategic real estate development. A graduate of Washington State University, Nathan leverages his expertise in financial planning and consulting to enhance RedDev’s projects, ensuring that each development aligns with both investor expectations and community impact goals.",
      "In his role at RedDev, Nathan is deeply involved in project evaluation, capital structuring, and financial analysis. His focus on long-term value creation and sustainable growth complements RedDev’s mission to deliver high-quality real estate investments. Nathan’s collaborative approach and financial insight enable RedDev to implement effective strategies that support investor wealth while fostering community development.",
    ],
    email: "nathanwadhwani@reddevrei.com",
    phone: "(778) 859-7729",
    image: "/brand/nathan-wadhwani.png",
  },
  {
    name: "Michael Polan",
    role: "Manager, International Agencies",
    bio: [
      "Mike Polan joins RedDev Real Estate Investments with over 20 years of experience in international education, marketing, and strategic planning. Having led recruitment and exchange programs across North America, Asia, and Latin America, Mike is known for his ability to forge strong global partnerships that drive growth. His career highlights include opening new international markets in India, managing one of Canada’s largest German and Mexican exchange programs, and consistently delivering on ambitious recruitment targets for diverse educational institutions.",
      "At RedDev, Mike focuses on managing and expanding the company’s international agency relationships, ensuring that RedDev’s real estate projects reach investors and communities worldwide. By leveraging his expertise in cross-cultural communication and team leadership, he enhances RedDev’s global network and drives strategic opportunities that align with the company’s vision for transparent, high-value real estate developments.",
    ],
    email: "michaelpolan@reddevrei.com",
    phone: "(604) 836-4558",
  },
  {
    name: "Jacob Wadhwani",
    role: "Marketing Associate",
    bio: [
      "Jacob Wadhwani is a Marketing Associate at RedDev Real Estate Investments, specializing in media production and strategic communications. Currently pursuing an economics degree at Simon Fraser University, Jacob combines his knowledge of real estate marketing with his background in property management and digital media. His work in crafting visual content supports RedDev’s investor engagement and brand visibility.",
      "In his role, Jacob focuses on enhancing RedDev’s online presence and communication with investors through strategic content creation. His expertise in video production and social media marketing enables RedDev to share project progress, investment insights, and success stories, effectively strengthening relationships with the investor community.",
    ],
    email: "jacobwadhwan@reddevrei.com",
    phone: "(778) 865-7939",
  },
  {
    name: "Reid Muller",
    role: "Sales Associate",
    bio: [
      "Reid Muller, an Associate at RedDev Real Estate Investments, brings a background in business and economics with a focus on marketing and investment communication. His expertise in behavioral research and strategic workforce development informs his approach to investor relations and project marketing at RedDev, where he works to present clear, compelling investment opportunities.",
      "At RedDev, Reid’s role includes developing marketing materials and ensuring investors are well-informed about project developments and investment benefits. His analytical skills and strategic thinking support RedDev’s efforts to foster investor trust and transparency, aligning with the company’s commitment to clear communication and client satisfaction.",
    ],
    email: "reidmuller@reddevrei.com",
    phone: "(604) 928-9378",
  },
  {
    name: "Kaden Moravek",
    role: "Sales Associate",
    bio: [
      "Kaden Moravek is a Marketing and Sales Associate at RedDev Real Estate Investments, where he applies his entrepreneurial background in business development and digital marketing. Kaden’s experience includes launching e-commerce ventures and building financial tools for startups, skills that he now brings to support RedDev’s affordable housing projects.",
      "At RedDev, Kaden’s focus is on digital marketing strategy and investor outreach for student housing developments. His commitment to impactful growth aligns with RedDev’s mission to provide accessible, high-quality housing solutions. Kaden’s innovative approach and marketing acumen strengthen RedDev’s efforts to connect with investors and promote the firm’s unique real estate opportunities.",
    ],
    email: "kadenmoravek@reddevrei.com",
    phone: "(236) 868-0435",
  },
];

export const teamProfileSources = {
  primary: "https://reddevrei.com/about-us/",
  contact: "https://reddevrei.com/contact-us-2/",
  notes:
    "Biographies, roles, individual email addresses, and telephone numbers are transcribed from RedDev's public About Us page. The site-wide contact details are corroborated on the public contact page.",
} as const;
