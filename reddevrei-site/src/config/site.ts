export const site = {
  key: "reddevrei",
  name: "RedDev Real Estate Investments",
  email: "info@reddevrei.com",
  phone: "604-729-7077",
  phoneHref: "tel:+16047297077",
  location: "Maple Ridge, British Columbia",
  originalSite: "https://reddevrei.com",
  publicOrigin: process.env.NEXT_PUBLIC_SITE_ORIGIN || undefined,
  indexable: process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true",
  inquiryMode: "email-draft" as const,
};

export const navigation = [
  { label: "Home", href: "/" },
  {
    label: "About Us",
    href: "/#about",
    children: [
      { label: "Our Company", href: "/#about" },
      { label: "Our Team", href: "/#team" },
    ],
  },
  { label: "Our Approach", href: "/#approach" },
  { label: "Student Housing", href: "/#student-housing" },
  {
    label: "Invest With Us",
    href: "/#invest",
    children: [
      { label: "Investing with RedDev", href: "/#invest" },
      { label: "Speak with Our Team", href: "/contact/?type=investment" },
    ],
  },
  { label: "Insights", href: "/#insights" },
] as const;
